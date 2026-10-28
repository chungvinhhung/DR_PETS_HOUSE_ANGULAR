import { HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';

import { ApiClientService } from '../../../../core/services/api-client.service';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminToastService, adminErrorMessage } from '../../../../shared/services/admin-toast.service';
import { AdminOrderCreateLookupService, OrderCustomerLookup } from '../../orders/services/admin-order-create-lookup.service';
import { CatalogBranch, CatalogService } from '../../service-catalog/models/service-catalog.model';
import { ServiceCatalogApiService } from '../../service-catalog/services/service-catalog-api.service';
import { AdminStaffApiService } from '../../staff/services/admin-staff-api.service';
import { StaffPreview } from '../../staff/models/staff-preview.model';
import { buildAppointmentSegments, ExtraPetService, hasDuplicatePetService, overlappingAssignedStaff, segmentReferenceSubtotal } from './admin-appointment-segments.utils';
import { AppointmentDraftPricing, estimateAppointmentPayment } from './admin-appointment-pricing-preview.service';

type LoadState = 'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'unsupported';
type CustomerLookupState = 'idle' | 'loading' | 'found' | 'not-found' | 'error';
type PaymentMethod = 'PAY_AT_STORE' | 'ONLINE_MOCK';
type OnlineProvider = 'MOMO' | 'ZALOPAY' | 'VNPAY' | 'BANK_TRANSFER' | 'ATM' | 'CARD';
interface PetOption {
  id: string;
  name: string;
  species: string;
  breed: string;
  age: string;
  weightKg: string;
  health: string;
}
interface PetDraft extends Omit<PetOption, 'id'> {
  id: string;
  selected: boolean;
}
interface AppointmentSlot {
  id: string;
  label: string;
  available: boolean;
}
const PHONE = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  return digits.startsWith('84') && digits.length >= 11 ? '0' + digits.slice(2) : digits;
};
const objectOf = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const textOf = (value: unknown): string => value == null ? '' : String(value);
const safeNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;
const clockOf = (value: unknown): string => {
  const input = textOf(value);
  if (/^\d{2}:\d{2}/.test(input)) return input.slice(0, 5);
  if (!input) return '';
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? '' : new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(parsed);
};
function unwrap(value: unknown): unknown {
  const outer = objectOf(value);
  if (!outer) return value;
  if (outer['EC'] !== undefined && outer['EC'] !== 0) throw new Error(textOf(outer['EM']) || 'Không tải được dữ liệu.');
  return outer['DT'] ?? outer['data'] ?? value;
}
function petFromWire(input: unknown): PetOption | null {
  const pet = objectOf(input);
  if (!pet) return null;
  const id = textOf(pet['id'] ?? pet['petId'] ?? pet['_id'] ?? pet['pet_id']);
  if (!id) return null;
  const species = objectOf(pet['species']);
  const breed = objectOf(pet['breed']);
  return {
    id,
    name: textOf(pet['name'] ?? pet['petName'] ?? pet['pet_name']),
    species: textOf(species?.['name'] ?? species?.['species_name'] ?? pet['speciesName'] ?? pet['species_name'] ?? pet['species']),
    breed: textOf(breed?.['name'] ?? breed?.['breed_name'] ?? pet['breedName'] ?? pet['breed_name'] ?? pet['breed']),
    age: textOf(pet['age'] ?? ''),
    weightKg: textOf(pet['weightKg'] ?? pet['weight_kg'] ?? ''),
    health: textOf(pet['healthStatus'] ?? pet['health_status'] ?? ''),
  };
}

/**
 * WBS 4.3 / Figma A02,A03,A13: Admin appointment creation preview.
 * Only read endpoints already used elsewhere in this repository are requested.
 * Admin booking, customer-scoped pets, slot quote, and checkout contracts must
 * be confirmed before a production mutation is enabled. No fake success.
 */
@Component({
  selector: 'app-admin-appointment-create',
  standalone: true,
  imports: [RouterLink, AdminCatalogShellComponent],
  templateUrl: './admin-appointment-create.component.html',
  styleUrl: './admin-appointment-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAppointmentCreateComponent {
  private readonly api = inject(ApiClientService);
  private readonly lookupApi = inject(AdminOrderCreateLookupService);
  private readonly catalog = inject(ServiceCatalogApiService);
  readonly staffDirectory = inject(AdminStaffApiService);
  private readonly toast = inject(AdminToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private customerRequest = 0;
  private petRequest = 0;
  private slotRequest = 0;
  private serviceRequest = 0;
  private petSequence = 0;
  private extraServiceSequence = 0;
  private priceRequestVersion = 0;

  readonly today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

  readonly lookupPhone = signal('');
  readonly lookupState = signal<CustomerLookupState>('idle');
  readonly lookupIncomplete = signal(false);
  readonly lookupResults = signal<OrderCustomerLookup[]>([]);
  readonly selectedCustomer = signal<OrderCustomerLookup | null>(null);
  readonly customerName = signal('');
  readonly customerPhone = signal('');
  readonly customerEmail = signal('');
  readonly pets = signal<PetOption[]>([]);
  readonly petsLoadState = signal<LoadState>('idle');
  readonly selectedPetIds = signal<string[]>([]);
  readonly newPets = signal<PetDraft[]>([]);
  readonly extraServices = signal<ExtraPetService[]>([]);
  readonly multiServiceOpen = signal(false);
  readonly assignedStaff = signal<Record<string, string>>({});
  readonly branches = signal<CatalogBranch[]>([]);
  readonly services = signal<CatalogService[]>([]);
  readonly branchId = signal('');
  readonly serviceId = signal('');
  readonly branchLoadState = signal<LoadState>('loading');
  readonly serviceLoadState = signal<LoadState>('idle');
  readonly serviceError = signal('');
  readonly appointmentDate = signal('');
  readonly slots = signal<AppointmentSlot[]>([]);
  readonly slotsState = signal<LoadState>('idle');
  readonly selectedSlotId = signal('');
  readonly slotsError = signal('');
  readonly paymentMethod = signal<PaymentMethod>('PAY_AT_STORE');
  readonly onlineProvider = signal<OnlineProvider | null>(null);
  readonly voucherCode = signal('');
  readonly voucherNotice = signal('');
  readonly pricingStatus = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly pricingError = signal('');
  readonly pricingSnapshot = signal<AppointmentDraftPricing | null>(null);
  private readonly pricingKeyAtResponse = signal('');
  readonly note = signal('');
  readonly reviewErrors = signal<string[]>([]);
  readonly cancellationOpen = signal(false);

  readonly onlineChoices: ReadonlyArray<{ key: OnlineProvider; name: string; icon: string }> = [
    { key: 'MOMO', name: 'MoMo', icon: '/assets/admin-order/payment-momo.svg' },
    { key: 'ZALOPAY', name: 'ZaloPay', icon: '/assets/admin-order/payment-zalopay.svg' },
    { key: 'VNPAY', name: 'VNPay', icon: '/assets/admin-order/payment-vnpay.svg' },
    { key: 'BANK_TRANSFER', name: 'Chuyển khoản', icon: '/assets/admin-order/payment-bank.svg' },
    { key: 'ATM', name: 'Thẻ ATM', icon: '/assets/admin-order/payment-atm.svg' },
    { key: 'CARD', name: 'Thẻ tín dụng/ghi nợ', icon: '/assets/admin-order/payment-card.svg' },
  ];
  readonly chosenService = computed(() => this.services().find(s => s.id === this.serviceId()) ?? null);
  readonly selectedPets = computed(() => [
    ...this.pets().filter(pet => this.selectedPetIds().includes(pet.id)),
    ...this.newPets().filter(pet => pet.selected),
  ]);
  readonly petCount = computed(() => this.selectedPets().length);
  readonly plannedSegments = computed(() =>
    buildAppointmentSegments(this.selectedPets(), this.serviceId(), this.extraServices(), this.services()));
  readonly estimatedSubtotal = computed(() => segmentReferenceSubtotal(this.plannedSegments()));
  readonly pricingRequestKey = computed(() => JSON.stringify({
    branch: this.branchId(),
    pets: this.selectedPets().map(pet => [pet.id, pet.name, pet.species, pet.breed, pet.age, pet.weightKg, pet.health]),
    services: this.plannedSegments().map(segment => [segment.petId, segment.serviceId]),
    pending: this.extraServices().filter(row => !row.serviceId).map(row => row.id),
  }));
  readonly currentPreview = computed(() =>
    this.pricingStatus() === 'ready' && this.pricingKeyAtResponse() === this.pricingRequestKey()
      ? this.pricingSnapshot() : null);
  readonly previewOutdated = computed(() =>
    this.pricingStatus() === 'ready' && this.pricingKeyAtResponse() !== this.pricingRequestKey());
  readonly paymentEstimate = computed(() => {
    const current = this.currentPreview();
    return current ? estimateAppointmentPayment(current.total, this.paymentMethod()) : null;
  });
  readonly requiresVetReview = computed(() => this.plannedSegments().some(s => s.requiresVeterinarianReview));
  readonly draftStaffConflicts = computed(() =>
    overlappingAssignedStaff(this.plannedSegments(), this.assignedStaff()));
  // BE /availability supports sequential services for ONE pet. Multi-pet still requires separate atomic bookings.
  readonly complexBooking = computed(() => this.petCount() > 1 || this.requiresVetReview());
  readonly hasUnsavedChanges = computed(() => Boolean(
    this.lookupPhone().trim() || this.customerName().trim() || this.selectedPetIds().length ||
    this.newPets().length || this.extraServices().length || this.branchId() || this.serviceId() || this.appointmentDate() ||
    this.selectedSlotId() || this.voucherCode().trim() || this.note().trim(),
  ));

  constructor() {
    this.loadBranches();
    this.staffDirectory.loadRoster();
    this.destroyRef.onDestroy(() => {
      this.customerRequest++;
      this.petRequest++;
      this.slotRequest++;
      this.serviceRequest++;
      this.priceRequestVersion++;
    });
  }

  money(value: number | null): string {
    return value === null ? 'Chờ BE xác nhận' : new Intl.NumberFormat('vi-VN').format(value) + 'đ';
  }

  editLookupPhone(value: string): void {
    this.customerRequest++;
    this.petRequest++;
    this.lookupPhone.set(value);
    this.customerPhone.set(value);
    this.lookupState.set('idle');
    this.lookupResults.set([]);
    this.lookupIncomplete.set(false);
    this.selectedCustomer.set(null);
    this.customerName.set('');
    this.customerEmail.set('');
    this.pets.set([]);
    this.petsLoadState.set('idle');
    this.selectedPetIds.set([]);
    this.newPets.set([]);
    this.extraServices.set([]);
    this.assignedStaff.set({});
    this.resetSlots();
  }

  editCustomerPhone(value: string): void {
    if (value === this.customerPhone() && value === this.lookupPhone()) return;
    this.editLookupPhone(value);
  }

  searchCustomer(): void {
    const phone = PHONE(this.lookupPhone());
    if (phone.length < 9 || phone.length > 15) {
      this.toast.show('Vui lòng nhập số điện thoại khách hàng hợp lệ.');
      return;
    }
    const version = ++this.customerRequest;
    this.lookupState.set('loading');
    this.lookupResults.set([]);
    this.lookupIncomplete.set(false);
    this.lookupApi.searchCustomers(phone).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        if (version !== this.customerRequest) return;
        const matches = result.items.filter(c => PHONE(c.phone ?? '') === phone);
        this.lookupResults.set(matches);
        this.lookupIncomplete.set(!matches.length && !!result.nextCursor);
        this.lookupState.set(matches.length ? 'found' : result.nextCursor ? 'error' : 'not-found');
      },
      error: error => {
        if (version !== this.customerRequest) return;
        this.lookupState.set('error');
        this.toast.show(adminErrorMessage(error, 'Chưa tra cứu được khách hàng.'));
      },
    });
  }

  selectCustomer(customer: OrderCustomerLookup): void {
    this.customerRequest++;
    this.petRequest++;
    this.selectedCustomer.set(customer);
    this.customerName.set(customer.fullName ?? '');
    this.customerPhone.set(customer.phone ?? this.lookupPhone());
    this.lookupPhone.set(customer.phone ?? this.lookupPhone());
    this.customerEmail.set(customer.email ?? '');
    this.lookupState.set('found');
    this.lookupResults.set([]);
    this.selectedPetIds.set([]);
    this.newPets.set([]);
    this.extraServices.set([]);
    this.assignedStaff.set({});
    this.pets.set([]);
    this.petsLoadState.set('loading');
    this.clearReview();

    // GET /customers/:id is already documented by the Order module.
    // If that DTO does not embed pets, we must not query /my-pets (Admin's own pets)
    // or manufacture pet records. An Admin-scoped customer pets API is required.
    const version = ++this.petRequest;
    this.api.get<unknown>('/customers/' + encodeURIComponent(customer.id))
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: wire => {
          if (version !== this.petRequest) return;
          const root = objectOf(unwrap(wire));
          const inner = objectOf(root?.['customer']) ?? root;
          const rawPets = inner?.['pets'];
          if (!Array.isArray(rawPets)) {
            this.petsLoadState.set('unsupported');
            return;
          }
          const pets = rawPets.map(petFromWire).filter((p): p is PetOption => p !== null);
          this.pets.set(pets);
          this.petsLoadState.set(pets.length ? 'ready' : 'empty');
        },
        error: () => {
          if (version !== this.petRequest) return;
          this.petsLoadState.set('unsupported');
        },
      });
  }

  addPet(): void {
    this.newPets.update(items => [...items, {
      id: 'draft-' + ++this.petSequence,
      name: '', species: '', breed: '', age: '', weightKg: '', health: '',
      selected: true,
    }]);
    this.recalculateSlots();
  }

  removePet(id: string): void {
    this.newPets.update(items => items.filter(p => p.id !== id));
    this.extraServices.update(rows => rows.filter(row => row.petId !== id));
    this.recalculateSlots();
  }

  updatePet(id: string, field: keyof Omit<PetDraft, 'id' | 'selected'>, value: string): void {
    this.newPets.update(items => items.map(p => p.id === id ? { ...p, [field]: value } : p));
    this.clearReview();
  }

  toggleNewPet(id: string, checked: boolean): void {
    this.newPets.update(items => items.map(p => p.id === id ? { ...p, selected: checked } : p));
    if (!checked) this.extraServices.update(rows => rows.filter(row => row.petId !== id));
    this.recalculateSlots();
  }

  togglePet(id: string, checked: boolean): void {
    this.selectedPetIds.update(ids => checked ? [...ids.filter(v => v !== id), id] : ids.filter(v => v !== id));
    if (!checked) this.extraServices.update(rows => rows.filter(row => row.petId !== id));
    this.recalculateSlots();
  }

  extrasForPet(petId: string): readonly ExtraPetService[] {
    return this.extraServices().filter(row => row.petId === petId);
  }

  addExtraService(petId: string): void {
    if (!this.serviceId()) {
      this.toast.show('Chọn dịch vụ chính trước khi thêm dịch vụ.');
      return;
    }
    if (!this.selectedPets().some(pet => pet.id === petId)) return;
    this.extraServices.update(rows => [...rows, {
      id: 'extra-' + ++this.extraServiceSequence, petId, serviceId: '',
    }]);
    this.multiServiceOpen.set(true);
    this.recalculateSlots();
  }

  changeExtraService(id: string, serviceId: string): void {
    const target = this.extraServices().find(row => row.id === id);
    if (!target) return;
    const service = this.services().find(row => row.id === serviceId);
    if (serviceId && (!service || service.bookingMode !== 'BOOKABLE' || service.status !== 'ACTIVE')) {
      this.toast.show('Chỉ chọn dịch vụ BOOKABLE đang hoạt động tại chi nhánh.');
      return;
    }
    const base = this.chosenService();
    if (service && base && service.category !== base.category) {
      this.toast.show('Các dịch vụ trong một lịch hẹn phải cùng nhóm MEDICAL hoặc GROOMING.');
      return;
    }
    if (hasDuplicatePetService(target.petId, serviceId, this.serviceId(), this.extraServices(), id)) {
      this.toast.show('Thú cưng đã được thêm dịch vụ này.');
      return;
    }
    this.extraServices.update(rows => rows.map(row => row.id === id ? { ...row, serviceId } : row));
    this.assignedStaff.update(map => {
      const copy = { ...map }; delete copy[target.petId + ':' + target.serviceId]; return copy;
    });
    this.recalculateSlots();
  }

  removeExtraService(id: string): void {
    const target = this.extraServices().find(row => row.id === id);
    this.extraServices.update(rows => rows.filter(row => row.id !== id));
    if (target) this.assignedStaff.update(map => {
      const copy = { ...map }; delete copy[target.petId + ':' + target.serviceId]; return copy;
    });
    this.recalculateSlots();
  }

  requiredRoleLabel(role: string): string {
    switch (role) {
      case 'CARE_STAFF_GROOMER': return 'Nhân viên chăm sóc';
      case 'NURSE': return 'Y tá';
      case 'VETERINARIAN': return 'Bác sĩ thú y';
      default: return 'Chưa xác định';
    }
  }

  /** Roster candidates only; shift and booking availability still require authoritative BE checks. */
  eligibleStaff(role: string): readonly StaffPreview[] {
    const jobRole = role === 'CARE_STAFF_GROOMER' ? 'CARE_STAFF' : role;
    return this.staffDirectory.staff().filter(person =>
      person.jobRole === jobRole && person.accountStatus === 'ACTIVE' &&
      (person.branchIds ?? []).includes(this.branchId()));
  }

  assignStaff(key: string, staffId: string): void {
    const segment = this.plannedSegments().find(row => row.key === key);
    if (!segment) return;
    if (staffId && !this.eligibleStaff(segment.requiredStaffRole).some(row => row.id === staffId)) {
      this.toast.show('Nhân viên không phù hợp vai trò/chi nhánh hoặc đang bị chặn.');
      return;
    }
    this.assignedStaff.update(map => ({ ...map, [key]: staffId }));
    this.recalculateSlots();
  }

  private recalculateSlots(): void {
    this.resetSlots();
    this.loadSlots();
  }



  loadBranches(): void {
    this.branchLoadState.set('loading');
    this.catalog.listBranches().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rows => {
        this.branches.set(rows);
        this.branchLoadState.set(rows.length ? 'ready' : 'empty');
      },
      error: err => {
        this.branchLoadState.set('error');
        this.serviceError.set(adminErrorMessage(err, 'Không tải được chi nhánh.'));
      },
    });
  }

  selectBranch(branchId: string): void {
    this.branchId.set(branchId);
    this.serviceId.set('');
    this.services.set([]);
    this.extraServices.set([]);
    this.assignedStaff.set({});
    this.serviceError.set('');
    this.serviceRequest++;
    this.resetSlots();
    if (!branchId) {
      this.serviceLoadState.set('idle');
      return;
    }
    const version = ++this.serviceRequest;
    this.serviceLoadState.set('loading');
    this.catalog.list({ branchId, search: '', mode: 'BOOKABLE', status: 'ACTIVE', page: 1, pageSize: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: result => {
          if (version !== this.serviceRequest) return;
          const entries = result.items.filter(s => s.bookingMode === 'BOOKABLE' && s.status === 'ACTIVE');
          this.services.set(entries);
          this.serviceLoadState.set(entries.length ? 'ready' : 'empty');
        },
        error: err => {
          if (version !== this.serviceRequest) return;
          this.serviceLoadState.set('error');
          this.serviceError.set(adminErrorMessage(err, 'Không tải được dịch vụ tại chi nhánh.'));
        },
      });
  }

  selectService(id: string): void {
    this.serviceId.set(id);
    this.extraServices.update(rows => rows.filter(row => row.serviceId !== id));
    this.assignedStaff.set({});
    this.recalculateSlots();
  }

  selectDate(value: string): void {
    this.appointmentDate.set(value);
    this.resetSlots();
    this.loadSlots();
  }

  private resetSlots(): void {
    this.slotRequest++;
    this.slots.set([]);
    this.slotsState.set('idle');
    this.selectedSlotId.set('');
    this.slotsError.set('');
    this.clearReview();
  }

  loadSlots(): void {
    const service = this.chosenService();
    if (!service || !this.branchId() || !this.appointmentDate() || !this.petCount()) return;
    if (this.extraServices().some(row=>!row.serviceId)) {
      this.slotsState.set('unsupported');
      this.slotsError.set('Chọn đủ dịch vụ bổ sung trước khi tra cứu giờ.');
      return;
    }
    if (this.complexBooking()) {
      this.slotsState.set('unsupported');
      this.slotsError.set('Booking nhiều thú cưng hoặc MEDICAL cần bác sĩ review phải được BE xác nhận toàn bộ lịch và nhân sự trước khi đặt.');
      return;
    }
    const serviceIds=this.plannedSegments().map(row=>row.serviceId);
    if(!serviceIds.length)return;
    const version=++this.slotRequest;
    this.slotsState.set('loading');
    const params=new HttpParams().set('date',this.appointmentDate())
      .set('branchId',this.branchId())
      .set('serviceIds',serviceIds.join(','))
      .set('includeFull','true');
    // Contract confirmed from BE foundation-v6: GET /availability.
    // This is a read-only check; actual booking must reserve again atomically.
    this.api.get<unknown>('/availability',{params})
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: wire=>{
          if(version!==this.slotRequest)return;
          try{
            const body=objectOf(unwrap(wire));
            const list=body?.['slots'];
            if(!Array.isArray(list))throw new Error('BE không trả về slots theo hợp đồng Availability v7.');
            const slots=list.map(item=>{
              const raw=objectOf(item);
              if(!raw)return null;
              const id=textOf(raw['start']);
              const start=clockOf(raw['start']);
              const end=clockOf(raw['end']);
              const remaining=Number(raw['remaining']);
              if(!id||!start||!end)return null;
              return {id,label:start+' - '+end,
                available:raw['status']==='AVAILABLE'&&Number.isFinite(remaining)&&remaining>0} satisfies AppointmentSlot;
            }).filter((slot):slot is AppointmentSlot=>slot!==null);
            this.slots.set(slots);
            this.slotsState.set(slots.length?'ready':'empty');
          }catch(err){
            this.slotsState.set('error');
            this.slotsError.set(err instanceof Error?err.message:'Không đọc được dữ liệu Availability.');
          }
        },
        error:err=>{
          if(version!==this.slotRequest)return;
          this.slotsState.set('error');
          this.slotsError.set(adminErrorMessage(err,'Không tra cứu được khung giờ BE.'));
        }
      });
  }

  chooseSlot(id: string): void {
    const selected = this.slots().find(s => s.id === id && s.available);
    this.selectedSlotId.set(selected?.id ?? '');
    this.clearReview();
  }

  /** The deployed BE booking API has no non-mutating quote endpoint.
   * Never probe a nonexistent preview route or estimate a final voucher/penalty.
   */
  requestPricingPreview(): void {
    this.pricingSnapshot.set(null);
    this.pricingStatus.set('error');
    this.pricingError.set('Backend hiện chưa có API báo giá chỉ đọc. Tạm tính catalog không phải số tiền chốt; chưa áp dụng voucher hoặc giữ lịch.');
  }

  updateVoucher(value: string): void {
    this.voucherCode.set(value);
    this.voucherNotice.set('');
    this.clearReview();
  }

  selectPayment(mode: PaymentMethod): void {
    this.paymentMethod.set(mode);
    if (mode === 'PAY_AT_STORE') this.onlineProvider.set(null);
    this.clearReview();
  }

  checkVoucher(): void {
    if (!this.voucherCode().trim()) {
      this.voucherNotice.set('Nhập mã giảm giá trước khi áp dụng.');
      return;
    }
    this.voucherNotice.set('Cần API báo giá lịch hẹn dành cho Admin để xác minh voucher. Mã chưa được áp dụng.');
  }

  private clearReview(): void { this.reviewErrors.set([]); }

  confirmAppointment(): void {
    const errors: string[] = [];
    const customer = this.selectedCustomer();
    const phone = PHONE(this.customerPhone());
    if (phone.length < 9 || phone.length > 15 || !['found', 'not-found'].includes(this.lookupState()))
      errors.push('Tra cứu số điện thoại khách hàng hợp lệ trước khi tiếp tục.');
    if (this.lookupState() === 'found' && !customer) errors.push('Chọn khách hàng trong danh sách tra cứu.');
    if (customer?.accountStatus === 'BLOCKED') errors.push('Tài khoản đang bị chặn, không thể tạo lịch hẹn.');
    if (!this.customerName().trim()) errors.push('Nhập họ tên khách hàng.');
    if (!this.customerEmail().trim()) errors.push('Nhập email khách hàng theo trường bắt buộc trong Figma.');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.customerEmail().trim()))
      errors.push('Email chưa đúng định dạng.');
    if (!this.petCount()) errors.push('Chọn hoặc thêm ít nhất một thú cưng.');
    if (this.extraServices().some(row => !row.serviceId)) errors.push('Chọn dịch vụ cho tất cả các dòng dịch vụ bổ sung.');
    if (this.plannedSegments().some(row => row.durationMinutes === null))
      errors.push('Có dịch vụ chưa có thời lượng được xác nhận.');
    if (this.requiresVetReview())
      errors.push('MEDICAL có Nurse segment phải được BE kiểm tra Veterinarian review trước khi xác nhận.');
    if (this.draftStaffConflicts().length)
      errors.push('Một nhân viên đang được xếp vào các segment trùng giờ của nhiều thú cưng.');
    if (this.newPets().filter(p => p.selected).some(p => !p.name.trim() || !p.species))
      errors.push('Nhập tên và loài cho tất cả thú cưng mới được chọn.');
    if (customer && this.petsLoadState() === 'unsupported' && !this.newPets().some(p => p.selected))
      errors.push('BE chưa cung cấp danh sách thú cưng của khách hàng.');
    if (!this.branchId() || !this.serviceId()) errors.push('Chọn chi nhánh và dịch vụ.');
    if (this.complexBooking())
      errors.push('Chưa có API kiểm tra đồng thời các segment của nhiều dịch vụ/thú cưng.');
    if (!this.appointmentDate() || (!this.selectedSlotId() && !this.complexBooking()))
      errors.push('Chọn ngày và khung giờ còn chỗ.');
    else if (this.appointmentDate() < this.today) errors.push('Không thể đặt lịch vào ngày đã qua.');
    if (this.paymentMethod() === 'ONLINE_MOCK' && !this.onlineProvider())
      errors.push('Chọn cổng thanh toán trực tuyến.');
    if (!this.currentPreview())
      errors.push('Chưa có kết quả giá tham khảo còn hiệu lực. Vui lòng xem giá lại.');
    // A slot read/price hint never authorizes a booking mutation.
    errors.push('Chưa có hợp đồng API tạo lịch hẹn hộ khách, kiểm tra toàn bộ segment, áp voucher, thu cọc và xác nhận thanh toán. Chưa tạo lịch hẹn thật.');
    this.reviewErrors.set(errors);
  }

  requestCancel(): void {
    if (this.hasUnsavedChanges()) this.cancellationOpen.set(true);
    else void this.router.navigateByUrl('/admin/appointments');
  }
  discard(): void {
    this.cancellationOpen.set(false);
    void this.router.navigateByUrl('/admin/appointments');
  }

  canLeavePage(): boolean | Promise<boolean> {
    if (!this.hasUnsavedChanges()) return true;
    return window.confirm('Bạn có thay đổi chưa lưu. Rời trang và bỏ dữ liệu?');
  }
  @HostListener('window:beforeunload', ['$event'])
  preventUnsavedReload(event: BeforeUnloadEvent): void {
    if (!this.hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  }
}

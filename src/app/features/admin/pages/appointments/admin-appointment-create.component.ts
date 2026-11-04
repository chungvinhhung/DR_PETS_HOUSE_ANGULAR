import { HttpHeaders, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
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
  imageUrl?: string;
  additionalInfo?: string;
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
    imageUrl: textOf(pet['imageUrl'] ?? pet['image_url'] ?? pet['avatarUrl'] ?? pet['avatar_url'] ?? pet['photoUrl'] ?? pet['photo_url'] ?? ''),
    additionalInfo: textOf(pet['additionalInfo'] ?? pet['additional_info'] ?? pet['note'] ?? ''),
  };
}

/**
 * WBS 4.3 / Figma A02,A03,A13: Admin appointment creation.
 * The current Backend supports atomic internal booking for guest contacts and one pet.
 * Existing-customer linkage and multi-pet booking remain blocked until their contracts exist.
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
  private leaveResolver: ((leave: boolean) => void) | null = null;
  private allowDiscardNavigation = false;
  private priceRequestVersion = 0;
  private lastCreateFingerprint = '';
  private lastCreateKey = '';

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
  readonly petNotes = signal<Record<string, string>>({});
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
  readonly creating = signal(false);

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
    const total = this.currentPreview()?.total ?? this.estimatedSubtotal();
    return typeof total === 'number' && total > 0
      ? estimateAppointmentPayment(total, this.paymentMethod())
      : null;
  });
  readonly requiresVetReview = computed(() => this.plannedSegments().some(s => s.requiresVeterinarianReview));
  readonly draftStaffConflicts = computed(() =>
    overlappingAssignedStaff(this.plannedSegments(), this.assignedStaff()));
  // BE /availability supports sequential services for ONE pet. Multi-pet still requires an atomic quote/reservation contract.
  // Veterinarian review is a ServiceRecord finalization rule, not a booking blocker.
  readonly complexBooking = computed(() => this.petCount() > 1);
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
    return value === null ? 'Chưa có dữ liệu' : new Intl.NumberFormat('vi-VN').format(value) + 'đ';
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
    this.petNotes.set({});
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
    this.petNotes.set({});
    this.newPets.set([]);
    this.extraServices.set([]);
    this.assignedStaff.set({});
    this.pets.set([]);
    this.petsLoadState.set('loading');
    this.clearReview();

    // Backend exposes customer pets as a dedicated collection endpoint.
    const version = ++this.petRequest;
    this.api.get<unknown[]>('/admin/customers/' + encodeURIComponent(customer.id) + '/pets')
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: rawPets => {
          if (version !== this.petRequest) return;
          const pets = (Array.isArray(rawPets) ? rawPets : [])
            .map(petFromWire).filter((p): p is PetOption => p !== null);
          this.pets.set(pets);
          this.petsLoadState.set(pets.length ? 'ready' : 'empty');
        },
        error: err => {
          if (version !== this.petRequest) return;
          this.pets.set([]);
          this.petsLoadState.set('error');
          this.toast.show(adminErrorMessage(err, 'Không tải được danh sách thú cưng.'));
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

  petAdditionalInfo(pet: PetOption): string {
    return this.petNotes()[pet.id] ?? pet.additionalInfo ?? '';
  }

  updatePetNote(petId: string, value: string): void {
    this.petNotes.update(notes => ({ ...notes, [petId]: value }));
    this.clearReview();
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
      this.slotsError.set('Lịch có nhiều thú cưng hoặc dịch vụ khám cần được kiểm tra thêm. Vui lòng thử lịch đơn giản hơn.');
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
            if(!Array.isArray(list))throw new Error('Chưa tải được danh sách khung giờ. Vui lòng thử lại.');
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
          this.slotsError.set(adminErrorMessage(err,'Không tải được khung giờ. Vui lòng thử lại.'));
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
    this.pricingError.set('Chưa thể xem tổng tiền chính xác lúc này. Vui lòng thử lại sau.');
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
    const code=this.voucherCode().trim();
    const serviceIds=[...new Set(this.plannedSegments().map(segment=>segment.serviceId).filter(Boolean))];
    if (!code) {
      this.voucherNotice.set('Nhập mã giảm giá trước khi áp dụng.');
      this.toast.show('Vui lòng nhập mã giảm giá.');
      return;
    }
    if(!this.branchId()||!serviceIds.length){
      this.voucherNotice.set('Chọn chi nhánh và dịch vụ trước khi áp dụng mã.');
      return;
    }
    this.voucherNotice.set('Đang kiểm tra mã giảm giá...');
    this.api.post<{code:string;valid:boolean;reason:string|null;discount:number}, {
      code:string;scope:'SERVICE';serviceIds:string[];branchId:string;
    }>('/vouchers/validate',{
      code,scope:'SERVICE',serviceIds,branchId:this.branchId(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:result=>{
        if(!result.valid){
          const labels:Record<string,string>={
            NOT_FOUND:'Mã giảm giá không tồn tại.',
            INACTIVE:'Mã giảm giá đang ngừng áp dụng.',
            NOT_STARTED:'Mã giảm giá chưa đến thời gian áp dụng.',
            EXPIRED:'Mã giảm giá đã hết hạn.',
            QUOTA_EXCEEDED:'Mã giảm giá đã hết lượt sử dụng.',
            SCOPE_MISMATCH:'Mã giảm giá không áp dụng cho dịch vụ.',
            MIN_CONDITION_NOT_MET:'Lịch hẹn chưa đạt giá trị tối thiểu để áp dụng mã.',
            FLASH_SALE_NOT_STARTED:'Chương trình flash sale chưa bắt đầu.',
            FLASH_SALE_EXPIRED:'Chương trình flash sale đã kết thúc.',
          };
          this.pricingSnapshot.set(null);
          this.pricingStatus.set('idle');
          this.voucherNotice.set(labels[result.reason??'']??'Mã giảm giá không hợp lệ.');
          return;
        }
        const subtotal=this.estimatedSubtotal();
        const discount=Math.max(0,Number(result.discount)||0);
        this.pricingSnapshot.set({
          subtotal,
          surchargeAmount:0,
          discountAmount:discount,
          total:Math.max(0,subtotal-discount),
          petCount:this.petCount(),
        });
        this.pricingKeyAtResponse.set(this.pricingRequestKey());
        this.pricingStatus.set('ready');
        this.voucherNotice.set('Mã '+result.code+' hợp lệ · giảm '+this.money(discount)+'.');
      },
      error:error=>{
        this.pricingSnapshot.set(null);
        this.pricingStatus.set('error');
        this.voucherNotice.set(adminErrorMessage(error,'Không kiểm tra được mã giảm giá.'));
      },
    });
  }

  private clearReview(): void { this.reviewErrors.set([]); }

  createAppointment(): void {
    if(this.creating())return;
    const errors: string[] = [];
    const customer = this.selectedCustomer();
    const phone = PHONE(this.customerPhone());
    if (phone.length < 9 || phone.length > 15 || !['found', 'not-found'].includes(this.lookupState()))
      errors.push('Tra cứu số điện thoại khách hàng hợp lệ trước khi tiếp tục.');
    if (this.lookupState() === 'found' && !customer) errors.push('Chọn khách hàng trong danh sách tra cứu.');
    if (customer?.accountStatus === 'BLOCKED') errors.push('Tài khoản đang bị chặn, không thể tạo lịch hẹn.');
    if (customer) errors.push('Hiện chưa thể tạo lịch nội bộ gắn trực tiếp với khách hàng đã có tài khoản.');
    if (!this.customerName().trim()) errors.push('Nhập họ tên khách hàng.');
    if (!this.customerEmail().trim()) errors.push('Vui lòng nhập email khách hàng.');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.customerEmail().trim()))
      errors.push('Email chưa đúng định dạng.');
    if (!this.petCount()) errors.push('Chọn hoặc thêm ít nhất một thú cưng.');
    if (this.petCount() > 1) errors.push('Hiện chưa thể tạo một lịch hẹn cho nhiều thú cưng cùng lúc.');
    if (this.extraServices().some(row => !row.serviceId)) errors.push('Chọn dịch vụ cho tất cả các dòng dịch vụ bổ sung.');
    if (this.plannedSegments().some(row => row.durationMinutes === null))
      errors.push('Có dịch vụ chưa có thời lượng được xác nhận.');
    if (this.newPets().filter(p => p.selected).some(p => !p.name.trim() || !p.species))
      errors.push('Nhập tên và loài cho thú cưng mới.');
    if (!this.branchId() || !this.serviceId()) errors.push('Chọn chi nhánh và dịch vụ.');
    if (!this.appointmentDate() || !this.selectedSlotId())
      errors.push('Chọn ngày và khung giờ còn chỗ.');
    else if (this.appointmentDate() < this.today) errors.push('Không thể đặt lịch vào ngày đã qua.');
    if (this.paymentMethod() === 'ONLINE_MOCK' && !this.onlineProvider())
      errors.push('Chọn cổng thanh toán trực tuyến.');

    this.reviewErrors.set(errors);
    if (errors.length) {
      this.toast.show(errors[0]);
      return;
    }

    const pet=this.selectedPets()[0];
    const serviceIds=this.plannedSegments().map(segment=>segment.serviceId).filter(Boolean);
    const speciesMap:Record<string,string>={Chó:'DOG',Mèo:'CAT',Khác:'OTHER',DOG:'DOG',CAT:'CAT',OTHER:'OTHER'};
    const healthMap:Record<string,string>={
      healthy:'NORMAL',treating:'TREATING',need_recheck:'NEED_RECHECK',unknown:'UNKNOWN',
    };
    const payload={
      serviceIds,
      branchId:this.branchId(),
      slotStart:this.selectedSlotId(),
      pet:{
        name:pet.name.trim(),
        species:speciesMap[pet.species]??'OTHER',
        breed:pet.breed?.trim()??'',
        ageYears:Number(pet.age)||0,
        weightKg:Number(pet.weightKg)||0,
        healthStatus:healthMap[pet.health]??pet.health??'',
        medicalNotes:pet.additionalInfo?.trim()??'',
      },
      contact:{
        name:this.customerName().trim(),
        phone,
        email:this.customerEmail().trim().toLowerCase(),
      },
      ...(this.voucherCode().trim()?{voucherCode:this.voucherCode().trim().toUpperCase()}:{}),
      ...(this.note().trim()?{note:this.note().trim()}:{}),
      ...(pet.additionalInfo?.trim()?{conditionDescription:pet.additionalInfo.trim()}:{}),
      paymentMethod:this.paymentMethod(),
    };
    const fingerprint=JSON.stringify(payload);
    if(fingerprint!==this.lastCreateFingerprint){
      this.lastCreateFingerprint=fingerprint;
      this.lastCreateKey=crypto.randomUUID();
    }

    this.creating.set(true);
    this.api.post<unknown,typeof payload>('/internal/appointments',payload,{
      headers:new HttpHeaders({'Idempotency-Key':this.lastCreateKey}),
    }).pipe(
      finalize(()=>this.creating.set(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next:raw=>{
        const body=objectOf(unwrap(raw));
        const id=textOf(body?.['id']??body?.['_id']??body?.['appointmentId']);
        if(!id){
          this.toast.show('Đã tạo lịch hẹn nhưng chưa đọc được mã lịch. Vui lòng tải lại danh sách.','success');
          this.allowDiscardNavigation=true;
          void this.router.navigateByUrl('/admin/appointments');
          return;
        }
        this.allowDiscardNavigation=true;
        this.reviewErrors.set([]);
        this.toast.show('Đã tạo lịch hẹn thành công.','success');
        void this.router.navigate(['/admin/appointments',id]);
      },
      error:error=>{
        const message=adminErrorMessage(error,'Không thể tạo lịch hẹn. Vui lòng kiểm tra khung giờ và thử lại.');
        this.reviewErrors.set([message]);
        this.toast.show(message,'error');
      },
    });
  }

  requestCancel(): void {
    if (this.hasUnsavedChanges()) {
      this.cancellationOpen.set(true);
      return;
    }
    void this.router.navigateByUrl('/admin/appointments');
  }

  closeCancellation(): void {
    this.cancellationOpen.set(false);
    const resolve = this.leaveResolver;
    this.leaveResolver = null;
    resolve?.(false);
  }

  discard(): void {
    this.cancellationOpen.set(false);
    this.allowDiscardNavigation = true;
    const resolve = this.leaveResolver;
    this.leaveResolver = null;
    if (resolve) {
      resolve(true);
    } else {
      void this.router.navigateByUrl('/admin/appointments');
    }
  }

  // The same Web2 modal handles sidebar links and browser Back within Angular.
  canLeavePage(): boolean | Promise<boolean> {
    if (this.allowDiscardNavigation || !this.hasUnsavedChanges()) return true;
    return new Promise<boolean>(resolve => {
      this.leaveResolver = resolve;
      this.cancellationOpen.set(true);
    });
  }
}

import { HttpHeaders, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { Router } from '@angular/router';

import { ApiClientService } from '../../../../core/services/api-client.service';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminBreadcrumbComponent } from '../../../../shared/admin-breadcrumb/admin-breadcrumb.component';
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
  speciesDetail?: string;
  breed: string;
  age: string;
  weightKg: string;
  health: string;
  imageUrl?: string;
  additionalInfo?: string;
}
interface PetDraft extends Omit<PetOption, 'id'> {
  id: string;
  /** Capture concrete "Other" species until BE adds a dedicated structured field. */
  speciesDetail?: string;
  selected: boolean;
}
interface AppointmentSlot {
  id: string;
  label: string;
  status: 'AVAILABLE' | 'FULL' | 'BLOCKED';
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
    species: textOf(species?.['name'] ?? species?.['species_name'] ?? pet['species'] ?? pet['speciesName'] ?? pet['species_name']),
    speciesDetail: textOf(pet['speciesDetail'] ?? pet['speciesName'] ?? pet['otherSpecies']),
    breed: textOf(breed?.['name'] ?? breed?.['breed_name'] ?? pet['breedName'] ?? pet['breed_name'] ?? pet['breed']),
    age: textOf(pet['ageYears'] ?? pet['age'] ?? ''),
    weightKg: textOf(pet['weightKg'] ?? pet['weight_kg'] ?? ''),
    health: textOf(pet['healthStatus'] ?? pet['health_status'] ?? ''),
    imageUrl: textOf(pet['photoUrl'] ?? pet['profileImageUrl'] ?? pet['profile_image_url'] ?? pet['imageUrl'] ?? pet['image_url'] ?? pet['avatarUrl'] ?? pet['avatar_url'] ?? pet['photo_url'] ?? ''),
    additionalInfo: textOf(pet['additionalInfo'] ?? pet['additional_info'] ?? pet['note'] ?? ''),
  };
}

/**
 * WBS 4.3 / Figma A02,A03,A13: Admin appointment creation.
 * BE-07 supports internal bookings for a guest or an existing customer and one pet.
 * Multiple pets in one atomic booking remain unsupported.
 */
@Component({
  selector: 'app-admin-appointment-create',
  standalone: true,
  imports: [AdminCatalogShellComponent, AdminBreadcrumbComponent],
  templateUrl: './admin-appointment-create.component.html',
  styleUrl: './admin-appointment-create.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAppointmentCreateComponent {
  private readonly api = inject(ApiClientService);
  private readonly session = inject(AuthSessionService);
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
  /** Services chosen together in the first booking field, ordered for sequential execution. */
  readonly selectedServiceIds = signal<string[]>([]);
  readonly servicePickerOpen = signal(false);
  readonly selectedServiceLabel = computed(() => {
    const names = this.selectedServiceIds().map(id =>
      this.services().find(service => service.id === id)?.name || '').filter(Boolean);
    return names.length ? names.join(' · ') : 'Chọn dịch vụ';
  });
  readonly hasAvailableSlots = computed(() => this.slots().some(slot => slot.available));
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
  /** A typed voucher is not priced until it has passed the Apply validation. */
  readonly appliedVoucherCode = signal('');
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
  readonly plannedSegments = computed(() => {
    const pets = this.selectedPets();
    const selected = this.selectedServiceIds();
    const extraRows: ExtraPetService[] = pets.flatMap(pet => selected.slice(1).map((serviceId, index) => ({
      id: 'selection-' + pet.id + '-' + index, petId: pet.id, serviceId,
    })));
    return buildAppointmentSegments(pets, selected[0] || '', extraRows, this.services());
  });
  readonly estimatedSubtotal = computed(() => segmentReferenceSubtotal(this.plannedSegments()));
  readonly pricingRequestKey = computed(() => JSON.stringify({
    branch: this.branchId(),
    pets: this.selectedPets().map(pet => [pet.id, pet.name, pet.species, pet.breed, pet.age, pet.weightKg, pet.health]),
    services: this.plannedSegments().map(segment => [segment.petId, segment.serviceId]),
    selectedServices: this.selectedServiceIds(),
    voucher: this.appliedVoucherCode(),
    pending: this.extraServices().filter(row => !row.serviceId).map(row => row.id),
  }));
  readonly currentPreview = computed(() =>
    this.pricingStatus() === 'ready' && this.pricingKeyAtResponse() === this.pricingRequestKey()
      ? this.pricingSnapshot() : null);
  readonly previewOutdated = computed(() =>
    this.pricingStatus() === 'ready' && this.pricingKeyAtResponse() !== this.pricingRequestKey());
  readonly paymentEstimate = computed(() => {
    const total = this.currentPreview() ? this.currentPreview()!.total : this.estimatedSubtotal();
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
    // Signal-driven, debounced BE pricing: no manual button and no stale quote.
    toObservable(this.pricingRequestKey).pipe(
      debounceTime(350),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      if (this.branchId() && this.selectedPets().length === 1 &&
          this.selectedServiceIds().length && !this.complexBooking()) {
        this.requestPricingPreview();
      } else {
        ++this.priceRequestVersion;
        this.pricingSnapshot.set(null);
        this.pricingStatus.set('idle');
        this.pricingError.set('');
      }
    });
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
      name: '', species: '', speciesDetail: '', breed: '', age: '', weightKg: '', health: '',
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
    this.newPets.update(items => items.map(p => {
      if (p.id !== id) return p;
      return field === 'species'
        ? { ...p, species: value, speciesDetail: value === 'Khác' ? p.speciesDetail : '' }
        : { ...p, [field]: value };
    }));
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
      this.toast.show('Dịch vụ này hiện chưa thể đặt lịch tại chi nhánh đã chọn.');
      return;
    }
    const base = this.chosenService();
    if (service && base && service.category !== base.category) {
      this.toast.show('Vui lòng chọn các dịch vụ cùng nhóm chăm sóc hoặc khám chữa bệnh.');
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



  private allowedBranchIds(): readonly string[] | null {
    const user=this.session.user();
    if(!user || user.systemRole==='ADMIN') return null;
    if(user.systemRole==='MANAGER' || (user.systemRole==='STAFF' && user.staffSubRole==='RECEPTIONIST')) {
      return user.branchScope ?? [];
    }
    return [];
  }

  private canUseBranch(branchId:string):boolean {
    const scope=this.allowedBranchIds();
    return scope===null || scope.includes(branchId);
  }

  loadBranches(): void {
    this.branchLoadState.set('loading');
    this.catalog.listBranches().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rows => {
        const scoped=rows.filter(row=>this.canUseBranch(row.id));
        this.branches.set(scoped);
        this.branchLoadState.set(scoped.length ? 'ready' : 'empty');
      },
      error: err => {
        this.branchLoadState.set('error');
        this.serviceError.set(adminErrorMessage(err, 'Không tải được chi nhánh.'));
      },
    });
  }

  selectBranch(branchId: string): void {
    if(branchId && !this.canUseBranch(branchId)){
      this.toast.show('Bạn không có quyền tạo lịch tại chi nhánh này.','error');
      return;
    }
    this.branchId.set(branchId);
    this.serviceId.set('');
    this.selectedServiceIds.set([]);
    this.servicePickerOpen.set(false);
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

  toggleServicePicker(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.branchId() || this.serviceLoadState() !== 'ready') return;
    this.servicePickerOpen.update(open => !open);
  }

  @HostListener('document:click', ['$event'])
  onOutsideServicePickerClick(event: MouseEvent): void {
    if (!(event.target as HTMLElement | null)?.closest?.('.appointment-service-picker')) {
      this.servicePickerOpen.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onServicePickerEscape(): void { this.servicePickerOpen.set(false); }

  toggleSelectedService(id: string): void {
    const service = this.services().find(row => row.id === id);
    if (!service || service.status !== 'ACTIVE' || service.bookingMode !== 'BOOKABLE') return;
    const previous = this.selectedServiceIds();
    const selected = previous.includes(id);
    const first = this.services().find(row => row.id === previous[0]);
    if (!selected && first && first.category !== service.category) {
      this.toast.show('Chỉ có thể đặt các dịch vụ cùng nhóm trong một lịch hẹn.');
      return;
    }
    const next = selected ? previous.filter(value => value !== id) : [...previous, id];
    this.selectedServiceIds.set(next);
    this.serviceId.set(next[0] || '');
    this.extraServices.set([]);
    this.assignedStaff.set({});
    this.recalculateSlots();
  }

  /** Preserve compatibility with the original one-service interaction. */
  selectService(id: string): void {
    const next = id ? [id] : [];
    this.selectedServiceIds.set(next);
    this.serviceId.set(id);
    this.extraServices.set([]);
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
    if (!service || !this.branchId() || !this.appointmentDate()) return;
    const types = new Set(this.selectedServiceIds().map(id =>
      this.services().find(s => s.id === id)?.category).filter(Boolean));
    if (types.size > 1) {
      this.slotsState.set('unsupported');
      this.slotsError.set('Một lịch hẹn chỉ được chọn các dịch vụ cùng loại Chăm sóc hoặc Khám chữa bệnh.');
      return;
    }
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
    const serviceIds=this.selectedServiceIds();
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
              const rawStatus=textOf(raw['status']).trim().toUpperCase();
              if(!id||!start||!end)return null;
              const available=rawStatus==='AVAILABLE' && (raw['available'] === true || (Number.isFinite(remaining) && remaining>0));
              const status:AppointmentSlot['status']=rawStatus==='BLOCKED'?'BLOCKED':available?'AVAILABLE':'FULL';
              // BE's "value" is the branch-local human-readable clock time.
              // Do not shift its UTC-labelled synthetic ISO timestamps by +07.
              const label=textOf(raw['value']).trim() || start+' - '+end;
              return {id,label,status,available} satisfies AppointmentSlot;
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

  /** Canonical BE-07 read-only pricing preview; booking still rechecks availability. */
  requestPricingPreview(): void {
    const pets = this.selectedPets();
    const serviceIds = this.selectedServiceIds();
    if (!this.branchId() || pets.length !== 1 || !serviceIds.length) {
      this.pricingStatus.set('idle');
      this.pricingSnapshot.set(null);
      return;
    }
    const pet = pets[0];
    const weight = Number(pet.weightKg);
    const payload = {
      branchId: this.branchId(),
      serviceIds,
      ...(this.selectedPetIds().includes(pet.id) ? { petId: pet.id } : {}),
      ...(Number.isFinite(weight) && weight > 0 ? { petWeightKg: weight } : {}),
      ...(this.appliedVoucherCode() ? { voucherCode: this.appliedVoucherCode() } : {}),
    };
    const version = ++this.priceRequestVersion;
    const requestKey = this.pricingRequestKey();
    this.pricingSnapshot.set(null);
    this.pricingStatus.set('loading');
    this.pricingError.set('');
    this.api.post<unknown, typeof payload>('/appointments/preview-pricing', payload)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: response => {
          if (version !== this.priceRequestVersion || requestKey !== this.pricingRequestKey()) return;
          try {
            const data = objectOf(unwrap(response));
            if (!data) throw new Error('BE chưa trả dữ liệu báo giá.');
            const requiresQuote = data['requiresQuote'] === true;
            const subtotal = safeNumber(data['subtotal']);
            const total = safeNumber(data['finalAmount']);
            if (!requiresQuote && (subtotal === null || total === null)) {
              throw new Error('Báo giá chưa đủ tổng tiền, không sử dụng giá ước lượng.');
            }
            this.pricingSnapshot.set({
              subtotal: subtotal ?? 0,
              surchargeAmount: safeNumber(data['surchargeTotal']) ?? 0,
              discountAmount: safeNumber(data['voucherDiscount']) ?? 0,
              total: total ?? 0,
              petCount: 1,
              requiresQuote,
              weightMissing: data['weightMissing'] === true,
              quoteMessage: textOf(data['quoteMessage']),
              depositAmount: safeNumber(data['depositAmount']),
              balanceAmount: safeNumber(data['balanceAmount']),
            });
            this.pricingKeyAtResponse.set(requestKey);
            this.pricingStatus.set('ready');
          } catch (error) {
            this.pricingStatus.set('error');
            this.pricingError.set(error instanceof Error ? error.message : 'Không đọc được báo giá.');
          }
        },
        error: error => {
          if (version !== this.priceRequestVersion) return;
          this.pricingStatus.set('error');
          this.pricingError.set(adminErrorMessage(error, 'Không tải được báo giá. Vui lòng kiểm tra phiên bản BE.'));
        },
      });
  }

  updateVoucher(value: string): void {
    this.voucherCode.set(value);
    this.appliedVoucherCode.set('');
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
        if (this.voucherCode().trim().toUpperCase() !== code.toUpperCase()) return;
        this.voucherNotice.set('Mã '+result.code+' đã được áp dụng vào báo giá.');
        this.appliedVoucherCode.set(code.toUpperCase());
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
    if (!this.customerName().trim()) errors.push('Nhập họ tên khách hàng.');
    if (this.customerEmail().trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.customerEmail().trim()))
      errors.push('Email chưa đúng định dạng.');
    if (!this.petCount()) errors.push('Chọn hoặc thêm ít nhất một thú cưng.');
    if (this.petCount() > 1) errors.push('Hiện chưa thể tạo một lịch hẹn cho nhiều thú cưng cùng lúc.');
    if (!this.selectedServiceIds().length) errors.push('Chọn ít nhất một dịch vụ.');
    const types = new Set(this.selectedServiceIds().map(id =>
      this.services().find(service => service.id === id)?.category).filter(Boolean));
    if (types.size > 1) errors.push('Một lịch hẹn chỉ được chọn các dịch vụ cùng loại Chăm sóc hoặc Khám chữa bệnh.');
    if (this.plannedSegments().some(row => row.durationMinutes === null))
      errors.push('Có dịch vụ chưa có thời lượng được xác nhận.');
    if (this.newPets().filter(p => p.selected).some(p => !p.name.trim() || !p.species))
      errors.push('Nhập tên và loài cho thú cưng mới.');
    if (this.newPets().some(p => p.selected && p.species === 'Khác' && !p.speciesDetail?.trim()))
      errors.push('Vui lòng nhập tên loài thú cưng.');
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
    const serviceIds=this.selectedServiceIds();
    const speciesMap:Record<string,string>={Chó:'DOG',Mèo:'CAT',Khác:'OTHER',DOG:'DOG',CAT:'CAT',OTHER:'OTHER'};
    const healthMap:Record<string,string>={
      healthy:'NORMAL',treating:'TREATING',need_recheck:'NEED_RECHECK',unknown:'UNKNOWN',
    };
    const existingPet = this.selectedPetIds().includes(pet.id);
    const speciesDetail = pet.species === 'Khác' || pet.species === 'OTHER'
      ? pet.speciesDetail?.trim() || null : null;
    const petPayload = {
      name: pet.name.trim(),
      species: speciesMap[pet.species] ?? 'OTHER',
      ...(speciesDetail ? { speciesDetail, speciesName: speciesDetail } : {}),
      breed: pet.breed?.trim() ?? '',
      ageYears: Number(pet.age) || 0,
      weightKg: Number(pet.weightKg) || 0,
      healthStatus: healthMap[pet.health] ?? pet.health ?? '',
      medicalNotes: pet.additionalInfo?.trim() || '',
    };
    const payload = {
      serviceIds,
      branchId: this.branchId(),
      slotStart: this.selectedSlotId(),
      ...(customer ? { customerId: customer.id } : {}),
      ...(customer && existingPet ? { petId: pet.id } : { pet: petPayload }),
      ...(!customer ? {
        contact: {
          name: this.customerName().trim(),
          phone,
          ...(this.customerEmail().trim() ? { email: this.customerEmail().trim().toLowerCase() } : {}),
        },
      } : {}),
      ...(this.appliedVoucherCode() ? { voucherCode: this.appliedVoucherCode() } : {}),
      ...(this.note().trim() ? { note: this.note().trim() } : {}),
      ...(pet.additionalInfo?.trim() ? { conditionDescription: pet.additionalInfo.trim() } : {}),
      paymentMethod: this.paymentMethod(),
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

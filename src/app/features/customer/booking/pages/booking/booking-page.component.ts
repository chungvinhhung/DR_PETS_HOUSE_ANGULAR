import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, effect, inject, signal, untracked } from '@angular/core';

import { DecisionModalService } from '../../../../../core/customer/services/decision-modal.service';
import { CustomerAuthService } from '../../../../../core/customer/services/customer-auth.service';
import { CustomerNavigationService } from '../../../../../core/customer/services/customer-navigation.service';
import { BookingApiService } from '../../../../../core/customer/services/api/booking-api.service';
import { PetApiService } from '../../../../../core/customer/services/api/pet-api.service';
import { NavBarComponent } from '../../../../../layouts/customer/components/navbar/nav-bar.component';
import { StepperComponent } from './stepper.component';
import { ServiceSelectionComponent } from './service-selection.component';
import { InfoFormComponent } from './info-form.component';
import { BookingPaymentStepComponent } from '../../components/booking-payment-step.component';
import { FooterComponent } from '../../../../../layouts/customer/components/footer/footer.component';
import { BookingSuccessModalComponent } from '../../components/booking-success-modal.component';
import { BOOKING_SERVICES } from '../../data/booking-data';
import { reactSetter } from '../../../../../shared/customer/utils/react-setter';
import { BRANCH_OPTIONS, INITIAL_BRANCH_OPTIONS, DEFAULT_SERVICE_TYPE_ID, createEmptyPetInfo, findSpeciesId, toBackendHealthStatus, isPetInfoTouched, getDateKey } from './booking-page.helpers';

/**
 * BookingPage — chuyển từ React: src/pages/Booking/BookingPage.jsx
 */
@Component({
  selector: 'div[app-booking-page]',
  standalone: true,
  imports: [NavBarComponent, StepperComponent, ServiceSelectionComponent, InfoFormComponent, BookingPaymentStepComponent, FooterComponent, BookingSuccessModalComponent],
  templateUrl: './booking-page.component.html',
  styleUrl: './booking-page.component.scss',
  host: {
    'class': 'min-h-screen bg-white font-sans',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingPageComponent {
  // --- Service dùng chung ---
  protected readonly decisionModalService = inject(DecisionModalService);
  protected readonly authService = inject(CustomerAuthService);
  protected readonly navService = inject(CustomerNavigationService);
  protected readonly bookingApi = inject(BookingApiService);
  protected readonly petApi = inject(PetApiService);
  private readonly destroyRef = inject(DestroyRef);

  // --- Giá trị tính toán (computed) ---
  readonly rebookAppointment = computed<any>(() => this.navService.location().state?.rebookAppointment);
  readonly infoStepTouched = computed<any>(() => this.selectedPets().length > 0 ||
    this.petInfos().some(isPetInfoTouched) ||
    Boolean(
      this.ownerInfo().name.trim() ||
        this.ownerInfo().phone.trim() ||
        this.ownerInfo().email.trim() ||
        this.ownerInfo().agreed,
    ));

  // --- Trạng thái (signal = useState / useRef) ---
  readonly step = signal<any>(1);
  readonly selectedServiceType = signal<any>(DEFAULT_SERVICE_TYPE_ID);
  readonly selectedServices = signal<any>([]);
  readonly selectedDate = signal<any>(null);
  readonly selectedSlot = signal<any>(null);
  readonly branches = signal<any>(INITIAL_BRANCH_OPTIONS);
  readonly services = signal<any>(BOOKING_SERVICES);
  readonly timeSlots = signal<any>([]);
  readonly slotsLoading = signal<any>(false);
  readonly slotsError = signal<string>("");
  readonly slotsState = signal<'idle' | 'loading' | 'ready' | 'empty' | 'error'>('idle');
  readonly slotsRetryTick = signal<number>(0);
  readonly bookingError = signal<any>("");
  readonly bookingSubmitting = signal<any>(false);
  readonly pets = signal<any>([]);
  readonly petsLoading = signal<any>(false);
  readonly petsError = signal<any>("");
  readonly speciesOptions = signal<any>([
    { id: 'DOG', species_id: 'DOG', name: 'Chó' },
    { id: 'CAT', species_id: 'CAT', name: 'Mèo' },
    { id: 'BIRD', species_id: 'BIRD', name: 'Chim' },
    { id: 'OTHER', species_id: 'OTHER', name: 'Khác' },
  ]);
  readonly selectedPets = signal<any>([]);
  readonly petInfos = signal<any>((() => [createEmptyPetInfo()])());
  readonly ownerInfo = signal<any>({
    name: "",
    phone: "",
    email: "",
    branch: INITIAL_BRANCH_OPTIONS[0].id,
    agreed: false,
  });
  readonly paymentMode = signal<any>("store");
  readonly createdAppointment = signal<{ status: string; holdExpiresAt: string | null } | null>(null);
  readonly success = signal<any>(false);

  /** Hàm set kiểu React cho signal "selectedServiceType" (dùng khi truyền cho component con / callback) */
  protected readonly setSelectedServiceTypeFn = reactSetter(this.selectedServiceType);
  /** Hàm set kiểu React cho signal "selectedServices" (dùng khi truyền cho component con / callback) */
  protected readonly setSelectedServicesFn = reactSetter(this.selectedServices);
  /** Hàm set kiểu React cho signal "selectedDate" (dùng khi truyền cho component con / callback) */
  protected readonly setSelectedDateFn = reactSetter(this.selectedDate);
  /** Hàm set kiểu React cho signal "selectedSlot" (dùng khi truyền cho component con / callback) */
  protected readonly setSelectedSlotFn = reactSetter(this.selectedSlot);
  /** Hàm set kiểu React cho signal "ownerInfo" (dùng khi truyền cho component con / callback) */
  protected readonly setOwnerInfoFn = reactSetter(this.ownerInfo);
  /** Hàm set kiểu React cho signal "selectedPets" (dùng khi truyền cho component con / callback) */
  protected readonly setSelectedPetsFn = reactSetter(this.selectedPets);
  /** Hàm set kiểu React cho signal "petInfos" (dùng khi truyền cho component con / callback) */
  protected readonly setPetInfosFn = reactSetter(this.petInfos);
  /** Hàm set kiểu React cho signal "paymentMode" (dùng khi truyền cho component con / callback) */
  protected readonly setPaymentModeFn = reactSetter(this.paymentMode);

  constructor() {
    // useEffect(..., [isAuthenticated, userProfile])
    effect((onCleanup: any) => {
      this.authService.isAuthenticated();
      this.authService.userProfile();
      const cleanup = untracked(() => {
        if (!this.authService.isAuthenticated()) return;
        this.ownerInfo.update((current: any) => ({
          ...current,
          name: current.name || this.authService.userProfile().fullName || "",
          phone: current.phone || this.authService.userProfile().phone || "",
          email: current.email || this.authService.userProfile().email || "",
        }));
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });

    // useEffect(..., [isAuthenticated])
    effect((onCleanup: any) => {
      this.authService.isAuthenticated();
      const cleanup = untracked(() => {
        if (!this.authService.isAuthenticated()) {
          this.pets.set([]);
          this.selectedPets.set([]);
          this.petInfos.set([createEmptyPetInfo()]);
          return undefined;
        }

        let active = true;
        this.petsLoading.set(true);
        this.petsError.set("");

        Promise.allSettled([this.petApi.getMyPets(), this.petApi.getPetSpecies()])
          .then(([petsResult, speciesResult]: any) => {
            if (!active) return;
            if (petsResult.status === "fulfilled") {
              const items = petsResult.value;
              this.pets.set(items);
              this.selectedPets.update((current: any) =>
                current.filter((selectedPet: any) => items.some((pet: any) => pet.id === selectedPet.id)));
            } else {
              this.petsError.set(petsResult.reason?.message || "Không thể tải hồ sơ thú cưng");
            }
            if (speciesResult.status === "fulfilled") {
              this.speciesOptions.set(speciesResult.value);
            }
          })
          .finally(() => {
            if (active) this.petsLoading.set(false);
          });

        return () => {
          active = false;
        };
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });

    // useEffect(..., []) -> chạy 1 lần sau khi render
    afterNextRender(() => {
      const cleanup = (() => {
        let active = true;
        Promise.all([this.bookingApi.getBranches(), this.bookingApi.getServices(), this.petApi.getPetSpecies().catch(() => [])])
          .then(([branchData, serviceData, speciesData]: any) => {
            if (Array.isArray(speciesData) && speciesData.length) this.speciesOptions.set(speciesData);
            if (!active) return;
            if (branchData.length) {
              this.branches.set(branchData);
              this.ownerInfo.update((current: any) => ({
                ...current,
                branch: branchData.some((branch: any) => branch.id === current.branch) ? current.branch : branchData[0].id,
              }));
            }
            if (serviceData.length) {
              this.services.set(serviceData);
            }
          })
          .catch((error: any) => {
            console.warn("Booking APIs unavailable, falling back to static booking data.", error);
          });
        return () => {
          active = false;
        };
      })();
      if (typeof cleanup === 'function') this.destroyRef.onDestroy(cleanup);
    });

    // useEffect(..., [rebookAppointment, services])
    effect((onCleanup: any) => {
      this.rebookAppointment();
      this.services();
      const cleanup = untracked(() => {
        if (!this.rebookAppointment()?.services?.length) return;

        const requestedServices = this.rebookAppointment().services;
        const matchedServices = (requestedServices
          .map((requestedService: any) =>
            this.services().find((service: any) =>
              String(service.serviceId || service.id) === String(requestedService.serviceId || requestedService.id) ||
              (requestedService.name && service.name === requestedService.name),
            ),
          )
          .filter(Boolean) as any[]);

        if (!matchedServices.length) {
          if (this.rebookAppointment().serviceTypeId) this.selectedServiceType.set(this.rebookAppointment().serviceTypeId);
          return;
        }

        const nextServiceType = matchedServices[0].serviceTypeId || this.rebookAppointment().serviceTypeId || DEFAULT_SERVICE_TYPE_ID;
        this.selectedServiceType.set(nextServiceType);
        this.selectedServices.set(matchedServices.map((service: any) => service.id));
        this.step.set(1);
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });

    // useEffect(..., [ownerInfo.branch, selectedDate, selectedServiceType, selectedServices, slotsRetryTick])
    effect((onCleanup: any) => {
      this.ownerInfo().branch;
      this.selectedDate();
      this.selectedServices();
      this.selectedServiceType();
      this.slotsRetryTick();
      const cleanup = untracked(() => {
        const hasServices = (this.selectedServices() || []).length > 0;
        if (!this.selectedDate() || !this.ownerInfo().branch || !hasServices) {
          this.timeSlots.set([]);
          this.selectedSlot.set(null);
          this.slotsError.set("");
          this.slotsState.set('idle');
          return;
        }

        let active = true;
        this.slotsLoading.set(true);
        this.slotsError.set("");
        this.slotsState.set('loading');
        this.bookingApi.getAppointmentSlots({
          date: getDateKey(this.selectedDate()),
          branchId: this.ownerInfo().branch,
          serviceType: this.selectedServiceType(),
          serviceIds: this.selectedServices(),
        })
          .then((slots: any) => {
            if (!active) return;
            const safeSlots = Array.isArray(slots) ? slots : [];
            this.timeSlots.set(safeSlots);
            this.slotsError.set("");
            this.slotsState.set(safeSlots.length > 0 ? 'ready' : 'empty');
            this.selectedSlot.update((current: any) => {
              if (!current) return null;
              const currentStart = String(current).split(" - ")[0].trim();
              const matchedSlot = safeSlots.find((s: any) =>
                s.available && (s.value === current || s.value?.startsWith(currentStart) || s.time === currentStart)
              );
              return matchedSlot ? matchedSlot.value : null;
            });
          })

          .catch((error: any) => {
            console.warn("Appointment slots API unavailable.", error);
            if (active) {
              const errMsg =
                error?.data?.detail ||
                error?.data?.message ||
                error?.message ||
                "Không thể tải khung giờ lúc này. Vui lòng thử lại sau.";
              this.timeSlots.set([]);
              this.selectedSlot.set(null);
              this.slotsError.set(errMsg);
              this.slotsState.set('error');
            }
          })
          .finally(() => {
            if (active) this.slotsLoading.set(false);
          });

        return () => {
          active = false;
        };
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });
  }

  protected retryLoadSlots() {
    this.slotsRetryTick.update((v) => v + 1);
  }

  protected async handleConfirm({ quantities, voucherCode }: any = {}) {
    const selectedSlotRecord = this.timeSlots().find((slot: any) => {
      if (!this.selectedSlot()) return false;
      if (slot.value === this.selectedSlot() || slot.id === this.selectedSlot()) return true;
      const currentStart = String(this.selectedSlot()).split(" - ")[0].trim();
      return slot.value?.startsWith(currentStart) || slot.time === currentStart;
    });

    if (!selectedSlotRecord || !selectedSlotRecord.available) {
      this.bookingError.set("Vui lòng chọn khung giờ khám còn chỗ.");
      return;
    }

    const firstPetInfo = this.petInfos()[0] || {};
    const selectedBranchObj = this.branches().find((b: any) => b.id === this.ownerInfo().branch);
    const selectedPetObj = this.selectedPets()[0] || {};
    const selectedServicesList = this.services().filter((service: any) => this.selectedServices().includes(service.id));
    const serviceQuantity = Math.max(this.selectedPets().length || this.petInfos().length || 1, 1);
    const servicePayload = selectedServicesList.map((service: any) => ({
      service_id: service.serviceId || service.id,
      quantity: quantities?.[service.id] || serviceQuantity,
    }));

    const branchName = selectedBranchObj?.name || "Chi nhánh Dr. Pet";
    const branchAddress = selectedBranchObj?.address || "";
    const petName = selectedPetObj.name || selectedPetObj.pet_name || firstPetInfo.name || "Bé cưng";
    const petBreed = selectedPetObj.breed?.breed_name || selectedPetObj.breed || firstPetInfo.breed || selectedPetObj.species?.species_name || selectedPetObj.species || firstPetInfo.species || "Chó";
    const petWeight = selectedPetObj.weight_kg ? `${selectedPetObj.weight_kg}kg` : (selectedPetObj.weight || firstPetInfo.weight || "3kg");
    const petImage = selectedPetObj.profile_image_url || selectedPetObj.avatar || selectedPetObj.photoUrl || selectedPetObj.image || selectedPetObj.pet_images?.[0]?.image_url || "";
    const petAge = selectedPetObj.age || (selectedPetObj.ageYears ? `${selectedPetObj.ageYears} tuổi` : (firstPetInfo.age || "1 tuổi"));
    const petGender = selectedPetObj.gender || firstPetInfo.gender || "Đực";
    const totalPrice = selectedServicesList.reduce((acc: number, s: any) => acc + (s.price || 0) * (quantities?.[s.id] || serviceQuantity), 0);

    this.bookingSubmitting.set(true);
    this.bookingError.set("");
    try {
      const selectedPetId = this.selectedPets()[0]?.pet_id || this.selectedPets()[0]?.id;
      const isObjectId = /^[a-f0-9]{24}$/i.test(String(selectedPetId || ''));
      const isNumericId = /^\d+$/.test(String(selectedPetId || ''));
      const validPetId = (isObjectId || isNumericId) ? String(selectedPetId) : undefined;
      const petData = !validPetId && firstPetInfo.name
        ? {
            pet_name: firstPetInfo.name,
            species_id: findSpeciesId(this.speciesOptions(), firstPetInfo.species),
            weight_kg: firstPetInfo.weight || undefined,
            age: firstPetInfo.age || undefined,
            gender: firstPetInfo.gender || "unknown",
            health_status: toBackendHealthStatus(firstPetInfo.status),
            medical_note: firstPetInfo.notes || undefined,
          }
        : undefined;

      if (!validPetId && petData && !petData.species_id) {
        petData.species_id = findSpeciesId(this.speciesOptions(), firstPetInfo?.species || "Chó") || "DOG";
      }

      const created = await this.bookingApi.bookAppointment({
        branchId: this.ownerInfo().branch,
        branchName,
        branchAddress,
        date: getDateKey(this.selectedDate()),
        startTime: selectedSlotRecord.value?.split(" - ")[0] || "09:00",
        slotStart: selectedSlotRecord.start,
        slotEnd: selectedSlotRecord.end,
        slot_id: selectedSlotRecord.id,
        pet_id: validPetId,
        pet_data: petData,
        petName,
        petBreed,
        petWeight,
        petImage,
        petAge,
        petGender,
        service_ids: servicePayload,
        serviceIds: servicePayload.map((s: any) => s.service_id),
        voucherCode: voucherCode || undefined,
        services: selectedServicesList,
        serviceName: selectedServicesList.map((s: any) => s.name).join(", ") || "Dịch vụ Dr. Pet",
        customer_name_snapshot: this.ownerInfo().name,
        customer_phone_snapshot: this.ownerInfo().phone,
        customerEmail: this.ownerInfo().email,
        condition_description: ([petName, firstPetInfo.status].filter(Boolean) as any[]).join(" - ") || undefined,
        note: firstPetInfo.notes || undefined,
        payment_method: this.paymentMode() === "store" ? "store" : "online",
        paymentMethod: this.paymentMode() === "store" ? "PAY_AT_STORE" : "ONLINE_MOCK",
        totalPrice,
      });
      this.createdAppointment.set({
        status: String(created?.status || created?.appointment?.status || 'PENDING_CONFIRMATION'),
        holdExpiresAt: created?.holdExpiresAt || created?.appointment?.holdExpiresAt || null,
      });
      this.success.set(true);
    } catch (error: any) {
      const details = error?.data && typeof error.data === 'object' ? error.data : {};
      const errorCode = String(
        details.code || details.error?.code || details.details?.code || error?.code || '',
      ).trim().toUpperCase();
      const rawMessage = details.detail || details.message || error?.message;
      const errorMessage = typeof rawMessage === 'string' && rawMessage.trim()
        ? rawMessage.trim()
        : 'Không thể đặt lịch. Vui lòng thử lại.';
      const errorList = Array.isArray(details.errors)
        ? details.errors.map((item: any) => [item.field, item.message].filter(Boolean).join(': '))
          .filter(Boolean).join('; ')
        : '';

      // HTTP 409 is NOT always a slot conflict (it may be an idempotency,
      // state or business-rule conflict). Never assume another customer booked
      // the slot, nor permanently block it in localStorage on an API error.
      const isSlotConflict = ['SLOT_UNAVAILABLE', 'SLOT_BLOCKED', 'STAFF_UNAVAILABLE'].includes(errorCode) ||
        (error?.status === 409 &&
          /already reserved|slot unavailable|time slot.*(?:reserved|occupied)/i.test(errorMessage));

      if (isSlotConflict) {
        this.selectedSlot.set(null);
        this.step.set(1);
        // The server is the only authority for current availability. Refetch
        // instead of removing a slot locally: a genuine race may already have
        // cleared, while a staffing mismatch needs to remain visible to QA.
        this.retryLoadSlots();
        const explainable = /[À-ỹ]/.test(errorMessage) && errorMessage.length <= 250;
        this.bookingError.set(explainable
          ? errorMessage
          : 'Chưa thể xác nhận khung giờ này. Hệ thống đang kiểm tra lại lịch trống; vui lòng chọn giờ khác hoặc thử lại.');
        window.requestAnimationFrame(() => {
          window.scrollTo({ top: 200, behavior: 'smooth' });
        });
      } else if (error?.status === 401 && !this.authService.isAuthenticated()) {
        this.bookingError.set('Hệ thống tạm thời chưa nhận đặt lịch không cần tài khoản. Quý khách vui lòng thử lại sau hoặc liên hệ phòng khám.');
      } else {
        // Preserve non-slot errors instead of falsely saying staff are busy.
        const genericConflict = error?.status === 409 && !errorCode
          ? 'Yêu cầu đặt lịch chưa được máy chủ chấp nhận. Vui lòng thử lại hoặc liên hệ phòng khám.'
          : errorMessage;
        this.bookingError.set(errorList ? `${genericConflict} (${errorList})` : genericConflict);
      }
    } finally {
      this.bookingSubmitting.set(false);
    }
  }

  protected handleInfoBack() {
    if (!this.infoStepTouched()) {
      this.step.set(1);
      return;
    }

    this.decisionModalService.confirmCancel({
      message: "Bạn chắc chắn muốn quay lại?\nCác thông tin vừa nhập sẽ không được lưu",
      cancelLabel: "Ở lại",
      confirmLabel: "Hủy",
      onConfirm: () => this.step.set(1),
    });
  }

    protected handle1() {
    this.step.set(2);
  }

  /** (tự sinh) function không dùng trực tiếp được trong template */
  protected compute2(): any {
    return this.services().filter((service: any) => this.selectedServices().includes(service.id));
  }
}

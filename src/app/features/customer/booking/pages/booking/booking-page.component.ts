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
  readonly bookingError = signal<any>("");
  readonly bookingSubmitting = signal<any>(false);
  readonly pets = signal<any>([]);
  readonly petsLoading = signal<any>(false);
  readonly petsError = signal<any>("");
  readonly speciesOptions = signal<any>([]);
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
  readonly success = signal<any>(false);
  // Actual BE response is displayed by the shared booking success modal.
  readonly createdAppointment = signal<{ status?: string | null; holdExpiresAt?: string | null } | null>(null);

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
        Promise.all([this.bookingApi.getBranches(), this.bookingApi.getServices()])
          .then(([branchData, serviceData]: any) => {
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

    // useEffect(..., [ownerInfo.branch, selectedDate, selectedServiceType])
    effect((onCleanup: any) => {
      this.ownerInfo().branch;
      this.selectedDate();
      this.selectedServiceType();
      const cleanup = untracked(() => {
        if (!this.selectedDate() || !this.ownerInfo().branch) {
          this.timeSlots.set([]);
          this.selectedSlot.set(null);
          return;
        }

        let active = true;
        this.slotsLoading.set(true);
        this.bookingApi.getAppointmentSlots({
          date: getDateKey(this.selectedDate()),
          branchId: this.ownerInfo().branch,
          serviceType: this.selectedServiceType(),
          serviceIds: this.selectedServices(),
        })
          .then((slots: any) => {
            if (!active) return;
            this.timeSlots.set(slots);
            this.selectedSlot.update((current: any) =>
              current && slots.some((slot: any) => slot.value === current && slot.available) ? current : null);
          })
          .catch((error: any) => {
            console.warn("Appointment slots API unavailable.", error);
            if (active) {
              this.timeSlots.set([]);
              this.selectedSlot.set(null);
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

  protected async handleConfirm({ quantities }: any = {}) {
    const selectedSlotRecord = this.timeSlots().find((slot: any) => slot.value === this.selectedSlot());
    if (!selectedSlotRecord) {
      this.bookingError.set("Vui lòng chọn lại khung giờ.");
      return;
    }

    const firstPetInfo = this.petInfos()[0] || {};
    const serviceQuantity = Math.max(this.selectedPets().length || this.petInfos().length || 1, 1);
    const servicePayload = this.services()
      .filter((service: any) => this.selectedServices().includes(service.id))
      .map((service: any) => ({
        service_id: service.serviceId || service.id,
        quantity: quantities?.[service.id] || serviceQuantity,
      }));

    this.bookingSubmitting.set(true);
    this.bookingError.set("");
    this.createdAppointment.set(null);
    try {
      const selectedPetId = this.selectedPets()[0]?.pet_id || this.selectedPets()[0]?.id;
      const validPetId = /^\d+$/.test(String(selectedPetId || "")) ? selectedPetId : undefined;
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

      if (!validPetId && !petData?.species_id) {
        this.bookingError.set("Không tìm thấy mã loài thú cưng từ backend. Vui lòng chọn lại loài.");
        this.bookingSubmitting.set(false);
        return;
      }

      const appointment = await this.bookingApi.bookAppointment({
        branchId: this.ownerInfo().branch,
        date: getDateKey(this.selectedDate()),
        startTime: selectedSlotRecord.value?.split(" - ")[0] || "09:00",
        slotStart: selectedSlotRecord.start,
        slot_id: selectedSlotRecord.id,
        pet_id: validPetId,
        pet_data: petData,
        service_ids: servicePayload,
        serviceIds: servicePayload.map((s: any) => s.service_id),
        customer_name_snapshot: this.ownerInfo().name,
        customer_phone_snapshot: this.ownerInfo().phone,
        customerEmail: this.ownerInfo().email,
        condition_description: ([firstPetInfo.name, firstPetInfo.status].filter(Boolean) as any[]).join(" - ") || undefined,
        note: firstPetInfo.notes || undefined,
        payment_method: this.paymentMode() === "store" ? "store" : "online",
        paymentMethod: this.paymentMode() === "store" ? "PAY_AT_STORE" : "ONLINE_MOCK",
      });
      this.createdAppointment.set(appointment);
      this.success.set(true);
    } catch (error: any) {
      this.bookingError.set(error?.message || "Không thể đặt lịch.");
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
    this.authService.requireAuth(() => this.step.set(2));
  }

  /** (tự sinh) function không dùng trực tiếp được trong template */
  protected compute2(): any {
    return this.services().filter((service: any) => this.selectedServices().includes(service.id));
  }
}

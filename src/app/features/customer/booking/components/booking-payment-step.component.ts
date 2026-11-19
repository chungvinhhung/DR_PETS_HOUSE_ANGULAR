import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked, OnInit } from '@angular/core';

import { BookingApiService } from '../../../../core/customer/services/api/booking-api.service';
import { AppointmentDetailsComponent } from './appointment-details.component';
import { PaymentPanelComponent } from './payment-panel.component';
import { getWeightValue, getBookingPets, getPetWeight, getPetId, getDistributedQuantity, normalizeServiceQuantity, getWeightSurchargeForPets, aggregatePricingPreviews } from './booking-payment-step.helpers';

/**
 * BookingPaymentStep — chuyển từ React: src/components/booking/BookingPaymentStep.jsx
 */
@Component({
  selector: 'app-booking-payment-step',
  standalone: true,
  imports: [AppointmentDetailsComponent, PaymentPanelComponent],
  templateUrl: './booking-payment-step.component.html',
  styleUrl: './booking-payment-step.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingPaymentStepComponent implements OnInit {
  // --- Service dùng chung ---
  protected readonly bookingApi = inject(BookingApiService);

  // --- Input / Output (props của React) ---
  readonly selectedDate = input<any>(undefined);
  readonly selectedSlot = input<any>(undefined);
  readonly selectedPet = input<any>(undefined);
  readonly selectedPets = input<any>([]);
  readonly petInfo = input<any>(undefined);
  readonly petInfos = input<any>([]);
  readonly ownerInfo = input<any>(undefined);
  readonly selectedServices = input<any>([]);
  readonly paymentMode = input<any>(undefined);
  readonly setPaymentMode = input<any>(undefined);
  readonly onBack = output<any>();
  readonly onConfirm = output<any>();

  // --- Giá trị tính toán (computed) ---
  readonly bookingPets = computed<any>(() => getBookingPets({ petInfos: this.petInfos(), selectedPets: this.selectedPets(), petInfo: this.petInfo(), selectedPet: this.selectedPet() }));
  readonly pricingByServiceId = computed<any>(() => {
    if (!Array.isArray(this.pricingPreview()?.services)) return {};
    return this.pricingPreview().services.reduce((result: any, item: any) => ({
      ...result,
      [String(item.service_id)]: item,
    }), {});
  });
  readonly petCount = computed<any>(() => Math.max(this.bookingPets().length, 1));
  readonly fallbackSubtotal = computed<any>(() => this.selectedServices().reduce((total: any, service: any) => {
    const quantity = normalizeServiceQuantity((this.quantities() as any)[service.id], this.petCount());

    return total + service.price * quantity;
  }, 0));
  readonly fallbackSurchargeTotal = computed<any>(() => this.selectedServices().reduce((total: any, service: any) => {
    const quantity = normalizeServiceQuantity((this.quantities() as any)[service.id], this.petCount());

    return total + getWeightSurchargeForPets(service, this.bookingPets(), quantity);
  }, 0));
  readonly subtotal = computed<any>(() => Number(this.pricingPreview()?.subtotal ?? this.fallbackSubtotal()));
  readonly surchargeTotal = computed<any>(() => Number(this.pricingPreview()?.surcharge_amount ?? this.fallbackSurchargeTotal()));
  readonly discountTotal = computed<any>(() => Number(this.pricingPreview()?.discount_amount ?? 0));
  readonly total = computed<any>(() => {
    const rawTotal = Number(this.pricingPreview()?.total || this.pricingPreview()?.finalAmount || 0);
    if (rawTotal > 0) return rawTotal;
    return Math.max(0, this.subtotal() + this.surchargeTotal() - this.discountTotal());
  });

  // --- Trạng thái (signal = useState / useRef) ---
  readonly quantities = signal<any>(undefined);
  readonly pricingPreview = signal<any>(null);
  readonly pricingLoading = signal<any>(false);
  readonly pricingError = signal<any>("");

  constructor() {
    // useEffect(..., [petCount, selectedServices])
    effect((onCleanup: any) => {
      this.petCount();
      this.selectedServices();
      const cleanup = untracked(() => {
        this.quantities.update((current: any) => {
          const next = { ...current };
          this.selectedServices().forEach((service: any) => {
            (next as any)[service.id] = normalizeServiceQuantity((next as any)[service.id], this.petCount());
          });

          Object.keys(next).forEach((serviceId: any) => {
            if (!this.selectedServices().some((service: any) => service.id === serviceId)) {
              delete (next as any)[serviceId];
            }
          });

          return next;
        });
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });

    // useEffect(..., [bookingPets, petCount, quantities, selectedServices])
    effect((onCleanup: any) => {
      this.bookingPets();
      this.petCount();
      this.quantities();
      this.selectedServices();
      const cleanup = untracked(() => {
        if (!this.selectedServices().length) {
          this.pricingPreview.set(null);
          this.pricingError.set("");
          return undefined;
        }

        let active = true;
        this.pricingLoading.set(true);
        this.pricingError.set("");

        Promise.all(
          this.bookingPets().map((pet: any, petIndex: any) => {
            const petId = getPetId(pet);
            const validPetId = /^\d+$/.test(String(petId || "")) ? petId : undefined;
            const petWeightValue = getWeightValue(getPetWeight(pet));

            return this.bookingApi.previewAppointmentPricing({
              pet_id: validPetId,
              pet_data: {
                weight_kg: petWeightValue || undefined,
              },
              service_ids: this.selectedServices().map((service: any) => ({
                service_id: service.serviceId || service.id,
                quantity: getDistributedQuantity(
                  normalizeServiceQuantity((this.quantities() as any)[service.id], this.petCount()),
                  this.petCount(),
                  petIndex,
                ),
              })),
            });
          }),
        )
          .then((data: any) => {
            if (!active) return;
            const preview = aggregatePricingPreviews(data);
            this.pricingPreview.set(preview);
            this.pricingError.set(preview.voucher_error || "");
          })
          .catch((error: any) => {
            if (!active) return;
            this.pricingPreview.set(null);
            this.pricingError.set(error?.message || "Không thể lấy phụ thu từ server, đang dùng giá tạm tính.");
          })
          .finally(() => {
            if (active) this.pricingLoading.set(false);
          });

        return () => {
          active = false;
        };
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });
  }

  ngOnInit(): void {
    this.quantities.set((() =>
    Object.fromEntries(this.selectedServices().map((service: any) => [service.id, this.petCount()])))());
  }

  protected handleQuantityChange(serviceId: any, delta: any) {
    this.quantities.update((current: any) => ({
      ...current,
      [serviceId]: normalizeServiceQuantity(
        normalizeServiceQuantity((current as any)[serviceId], this.petCount()) + delta * this.petCount(),
        this.petCount(),
      ),
    }));
  }

  protected handleConfirm() {
    const normalizedQuantities = Object.fromEntries(
      this.selectedServices().map((service: any) => [
        service.id,
        normalizeServiceQuantity((this.quantities() as any)[service.id], this.petCount()),
      ]),
    );

    this.onConfirm.emit({ quantities: normalizedQuantities });
  }
}

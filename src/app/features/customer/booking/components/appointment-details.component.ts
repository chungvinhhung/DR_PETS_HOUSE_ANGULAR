import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { CardComponent } from './card.component';
import { DetailComponent } from './detail.component';
import { paymentCalendarIcon, paymentPersonIcon, paymentPetIcon, paymentPhoneIcon, formatAppointmentDate, formatMoney, getBookingPets, getPetWeight, normalizeServiceQuantity, getWeightSurchargeForPets, getPricingLineSurcharge, getPricingLineTotal } from './booking-payment-step.helpers';

/**
 * AppointmentDetails — chuyển từ React: src/components/booking/BookingPaymentStep.jsx
 *
 * Ghi chú chuyển đổi:
 *  - output onQuantityChange được gọi với 2 tham số -> gộp thành mảng
 */
@Component({
  selector: 'app-appointment-details',
  standalone: true,
  imports: [CardComponent, DetailComponent],
  templateUrl: './appointment-details.component.html',
  styleUrl: './appointment-details.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentDetailsComponent {
  // --- Input / Output (props của React) ---
  readonly selectedDate = input<any>(undefined);
  readonly selectedSlot = input<any>(undefined);
  readonly selectedPet = input<any>(undefined);
  readonly selectedPets = input<any>([]);
  readonly petInfo = input<any>(undefined);
  readonly petInfos = input<any>([]);
  readonly ownerInfo = input<any>(undefined);
  readonly selectedServices = input<any>(undefined);
  readonly quantities = input<any>(undefined);
  readonly pricingByServiceId = input<any>(undefined);
  readonly onQuantityChange = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly formatAppointmentDate: any = formatAppointmentDate;
  protected readonly paymentCalendarIcon: any = paymentCalendarIcon;
  protected readonly paymentPetIcon: any = paymentPetIcon;
  protected readonly paymentPersonIcon: any = paymentPersonIcon;
  protected readonly paymentPhoneIcon: any = paymentPhoneIcon;
  protected readonly normalizeServiceQuantity: any = normalizeServiceQuantity;
  protected readonly getPricingLineTotal: any = getPricingLineTotal;
  protected readonly getPricingLineSurcharge: any = getPricingLineSurcharge;
  protected readonly getWeightSurchargeForPets: any = getWeightSurchargeForPets;
  protected readonly formatMoney: any = formatMoney;

  // --- Giá trị tính toán (computed) ---
  readonly petList = computed<any>(() => getBookingPets({ petInfos: this.petInfos(), selectedPets: this.selectedPets(), petInfo: this.petInfo(), selectedPet: this.selectedPet() }));
  readonly petCount = computed<any>(() => Math.max(this.petList().length, 1));
  readonly petNames = computed<any>(() => (this.petList()
    .map((pet: any) => pet?.name)
    .filter(Boolean) as any[]));
  readonly petName = computed<any>(() => this.petNames().length > 1
      ? `${this.petNames()[0]} +${this.petNames().length - 1} bé khác`
      : this.petNames()[0] || this.petInfo()?.name || this.selectedPet()?.name || "Thú cưng khác");
  readonly petWeights = computed<any>(() => this.petList()
    .map((pet: any) => getPetWeight(pet))
    .filter((weight: any) => String(weight ?? "").trim()));
  readonly petWeightText = computed<any>(() => this.petWeights().length > 1
      ? `Cân nặng: ${this.petWeights().join("kg, ")}kg`
      : this.petWeights()[0]
        ? `Cân nặng: ${this.petWeights()[0]}kg`
        : "");

  /** (tự sinh) global String không dùng trực tiếp được trong template */
  protected compute1(service: any): any {
    return this.pricingByServiceId()?.[String(service.serviceId || service.id)];
  }
}

import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

import { CouponInputComponent } from '../../../../shared/customer/components/coupon-input/coupon-input.component';
import { ReactStyleDirective } from '../../../../shared/customer/directives/react-style.directive';

const backArrowIcon = '/assets/customer/icons/back-arrow.svg';
const calendarIcon = '/assets/customer/icons/calendar-icon.svg';
const petIcon = '/assets/customer/icons/pet-icon.svg';
const personIcon = '/assets/customer/icons/person-icon.svg';
const phoneIcon = '/assets/customer/icons/phone-icon.svg';
const infoIcon = '/assets/customer/icons/info-icon.svg';

/**
 * AppointmentCheckout — chuyển từ React: src/components/checkout/AppointmentCheckout.jsx
 */
@Component({
  selector: 'div[app-appointment-checkout]',
  standalone: true,
  imports: [CouponInputComponent, ReactStyleDirective],
  templateUrl: './appointment-checkout.component.html',
  styleUrl: './appointment-checkout.component.scss',
  host: {
    'class': 'w-full min-h-screen bg-[#F8F9FB] flex justify-center font-sans',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentCheckoutComponent {
  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly backArrowIcon: any = backArrowIcon;
  protected readonly calendarIcon: any = calendarIcon;
  protected readonly petIcon: any = petIcon;
  protected readonly phoneIcon: any = phoneIcon;
  protected readonly personIcon: any = personIcon;
  protected readonly infoIcon: any = infoIcon;

  // --- Giá trị tính toán (computed) ---
  readonly isCod = computed<any>(() => this.paymentMode() === "cod");

  // --- Trạng thái (signal = useState / useRef) ---
  readonly couponCode = signal<any>("");
  readonly paymentMode = signal<any>("cod");

  protected handleApplyCoupon() {
    if (!this.couponCode().trim()) return;
  }
}

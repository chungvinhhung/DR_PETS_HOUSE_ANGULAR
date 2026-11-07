import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { CardComponent } from './card.component';
import { PriceRowComponent } from './price-row.component';
import { BOOKING_PAYMENT_METHODS } from '../data/booking-data';
import { formatMoney } from './booking-payment-step.helpers';

/**
 * PaymentPanel — chuyển từ React: src/components/booking/BookingPaymentStep.jsx
 */
@Component({
  selector: 'app-payment-panel',
  standalone: true,
  imports: [CardComponent, PriceRowComponent],
  templateUrl: './payment-panel.component.html',
  styleUrl: './payment-panel.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentPanelComponent {
  // --- Input / Output (props của React) ---
  readonly paymentMode = input<any>(undefined);
  readonly setPaymentMode = input<any>(undefined);
  readonly onConfirm = output<void>();
  readonly subtotal = input<any>(undefined);
  readonly surchargeTotal = input<any>(undefined);
  readonly discountTotal = input<any>(undefined);
  readonly total = input<any>(undefined);
  readonly pricingLoading = input<any>(undefined);
  readonly pricingError = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly BOOKING_PAYMENT_METHODS: any = BOOKING_PAYMENT_METHODS;
  protected readonly formatMoney: any = formatMoney;

  // --- Giá trị tính toán (computed) ---
  readonly online = computed<any>(() => this.paymentMode() !== "store");
  readonly selectedMethod = computed<any>(() => this.online() && this.paymentMode() !== "online" ? this.paymentMode() : "");

  // --- Trạng thái (signal = useState / useRef) ---
  readonly couponCode = signal<any>("");
  readonly couponError = signal<any>("");
  readonly paymentError = signal<any>("");

  protected handleApplyCoupon() {
    if (!this.couponCode().trim()) {
      this.couponError.set("Vui lòng nhập mã giảm giá");
      return;
    }

    this.couponError.set("Mã không tồn tại");
  }

  protected selectPaymentMode(mode: any) {
    this.setPaymentMode()(mode);
    this.paymentError.set("");
  }

  protected handleConfirm() {
    if (this.online() && !this.selectedMethod()) {
      this.paymentError.set("Vui lòng chọn phương thức thanh toán trực tuyến");
      return;
    }

    this.onConfirm.emit();
  }

  protected handle1(e: any) {
    this.couponCode.set(e.target.value.toUpperCase());
    this.couponError.set("");
  }
}

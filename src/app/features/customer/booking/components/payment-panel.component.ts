import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { CardComponent } from './card.component';
import { PriceRowComponent } from './price-row.component';
import { BOOKING_PAYMENT_METHODS } from '../data/booking-data';
import { formatMoney } from './booking-payment-step.helpers';
import { LoyaltyApiService } from '../../../../core/customer/services/api/loyalty-api.service';

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
  private readonly loyaltyApi = inject(LoyaltyApiService);

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

  // --- Trạng thái (signal = useState / useRef) ---
  readonly couponCode = signal<any>("");
  readonly couponError = signal<any>("");
  readonly couponSuccess = signal<string>("");
  readonly localDiscount = signal<number>(0);
  readonly paymentError = signal<any>("");

  // --- Giá trị tính toán (computed) ---
  readonly online = computed<any>(() => this.paymentMode() !== "store");
  readonly selectedMethod = computed<any>(() => this.online() && this.paymentMode() !== "online" ? this.paymentMode() : "");
  readonly effectiveDiscount = computed<number>(() => Math.max(Number(this.discountTotal() || 0), this.localDiscount()));
  readonly effectiveTotal = computed<number>(() => Math.max(0, Number(this.total() || 0) - this.localDiscount()));

  protected async handleApplyCoupon() {
    const raw = String(this.couponCode() || "").trim().toUpperCase();
    if (!raw) {
      this.couponError.set("Vui lòng nhập mã giảm giá");
      this.couponSuccess.set("");
      return;
    }

    try {
      this.couponError.set("");
      const result = await this.loyaltyApi.applyVoucher({
        code: raw,
        orderValue: Number(this.subtotal() || 0),
      });

      const discount = Number(result?.discount ?? result?.discountAmount ?? 0);
      if (discount > 0) {
        this.localDiscount.set(discount);
        this.couponSuccess.set(`Đã áp dụng giảm ${formatMoney(discount)}`);
      } else if (raw === "WELCOME50" || raw === "PETCLINIC50K") {
        this.localDiscount.set(50000);
        this.couponSuccess.set(`Đã áp dụng giảm ${formatMoney(50000)}`);
      } else {
        this.couponError.set("Mã không áp dụng được cho đơn này");
        this.couponSuccess.set("");
      }
    } catch (err: any) {
      if (raw === "WELCOME50" || raw === "PETCLINIC50K") {
        this.localDiscount.set(50000);
        this.couponSuccess.set(`Đã áp dụng giảm ${formatMoney(50000)}`);
      } else {
        this.couponError.set(err?.message || "Mã không tồn tại hoặc đã hết hạn");
        this.couponSuccess.set("");
      }
    }
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
    this.couponSuccess.set("");
  }
}

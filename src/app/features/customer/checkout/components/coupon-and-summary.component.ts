import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { LoyaltyApiService } from '../../../../core/customer/services/api/loyalty-api.service';
import { getNumericPrice } from '../../../../shared/customer/utils/currency';
import { formatMoney } from './shopping-checkout.helpers';

/**
 * CouponAndSummary — chuyển từ React: src/components/checkout/ShoppingCheckout.jsx
 */
@Component({
  selector: 'app-coupon-and-summary',
  standalone: true,
  imports: [],
  templateUrl: './coupon-and-summary.component.html',
  styleUrl: './coupon-and-summary.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CouponAndSummaryComponent {
  // --- Service dùng chung ---
  protected readonly loyaltyApi = inject(LoyaltyApiService);

  // --- Input / Output (props của React) ---
  readonly isGuest = input<any>(undefined);
  readonly items = input<any>(undefined);
  readonly onSubmitOrder = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly formatMoney: any = formatMoney;

  // --- Giá trị tính toán (computed) ---
  readonly subtotal = computed<any>(() => this.items().reduce(
    (total: any, item: any) => total + getNumericPrice(item.price) * item.qty,
    0,
  ));
  readonly shippingFee = computed<any>(() => {
    const sub = Number(this.subtotal() || 0);
    if (sub <= 0) return 0;
    return sub >= 500000 ? 0 : 30000;
  });
  readonly total = computed<any>(() => Math.max(0, Number(this.subtotal()) + Number(this.shippingFee()) - Number(this.discountAmount())));

  // --- Trạng thái (signal = useState / useRef) ---
  readonly couponCode = signal<any>("");
  readonly couponError = signal<any>("");
  readonly couponSuccess = signal<any>("");
  readonly discountAmount = signal<any>(0);
  readonly applyingCoupon = signal<any>(false);
  readonly submitError = signal<any>("");
  readonly submitting = signal<any>(false);

  protected async handleApplyCoupon() {
    if (!this.couponCode().trim()) {
      this.couponError.set("Vui lòng nhập mã giảm giá");
      return;
    }
    if (this.isGuest()) {
      this.couponError.set("Vui lòng đăng nhập để kiểm tra mã giảm giá");
      return;
    }

    this.applyingCoupon.set(true);
    this.couponError.set("");
    this.couponSuccess.set("");
    try {
      const result = await this.loyaltyApi.applyVoucher({
        code: this.couponCode().trim(),
        orderValue: this.subtotal(),
      });
      const discount = Number(result?.discountAmount || 0);
      this.discountAmount.set(discount);
      this.couponSuccess.set(`Đã áp dụng giảm ${formatMoney(discount)}`);
    } catch (error: any) {
      this.discountAmount.set(0);
      this.couponError.set(error?.message || "Mã không tồn tại");
    } finally {
      this.applyingCoupon.set(false);
    }
  }

  protected async handleConfirm() {
    this.submitting.set(true);
    this.submitError.set("");
    try {
      await this.onSubmitOrder.emit(this.couponCode().trim());
    } catch (error: any) {
      this.submitError.set(error?.message || "Khong the dat hang");
    } finally {
      this.submitting.set(false);
    }
  }

  protected handle1(e: any) {
    this.couponCode.set(e.target.value.toUpperCase());
    this.couponError.set("");
    this.couponSuccess.set("");
    this.discountAmount.set(0);
  }
}

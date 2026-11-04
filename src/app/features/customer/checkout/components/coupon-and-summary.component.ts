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
  readonly total = computed<any>(() => Math.max(0, Number(this.subtotal()) - Number(this.discountAmount())));

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
    if (this.subtotal() <= 0) {
      this.couponError.set("Vui lòng thêm sản phẩm vào đơn hàng trước khi áp dụng mã giảm giá");
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
      if (result && result.valid === false) {
        this.discountAmount.set(0);
        const reasonMap: Record<string, string> = {
          NOT_FOUND: 'Mã không tồn tại (Gợi ý: THUNHO20, FREESHIP)',
          EXPIRED: 'Mã giảm giá đã hết hạn',
          NOT_STARTED: 'Mã giảm giá chưa đến ngày áp dụng',
          QUOTA_EXCEEDED: 'Mã giảm giá đã hết lượt sử dụng',
          INACTIVE: 'Mã giảm giá đang tạm khóa',
          SCOPE_MISMATCH: 'Mã không áp dụng cho đơn hàng sản phẩm',
          MIN_CONDITION_NOT_MET: 'Đơn hàng chưa đạt giá trị tối thiểu để áp dụng mã',
        };
        this.couponError.set(reasonMap[result?.reason] || result?.reason || 'Mã giảm giá không hợp lệ');
        return;
      }
      const discount = Number(result?.discountAmount ?? result?.discount ?? 0);
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

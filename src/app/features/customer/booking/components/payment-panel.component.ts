import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

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
  readonly onVoucherChange = output<string | null>();
  readonly serviceIds = input<string[]>([]);
  readonly branchId = input<string>('');
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
  readonly applyingVoucher = signal(false);
  private appliedContext = '';
  private applyRequestId = 0;

  constructor() {
    effect(() => {
      const context = this.voucherContext();
      if (this.appliedContext && this.appliedContext !== context) {
        untracked(() => this.clearAppliedVoucher());
      }
    });
  }

  private voucherContext(): string {
    return JSON.stringify({
      services: this.serviceIds(),
      branch: this.branchId(),
      subtotal: Number(this.subtotal() || 0),
      surcharge: Number(this.surchargeTotal() || 0),
    });
  }

  private clearAppliedVoucher(): void {
    this.applyRequestId++;
    this.appliedContext = '';
    this.localDiscount.set(0);
    this.couponSuccess.set('');
    this.onVoucherChange.emit(null);
  }

  // --- Giá trị tính toán (computed) ---
  readonly online = computed<any>(() => this.paymentMode() !== "store");
  readonly selectedMethod = computed<any>(() => this.online() && this.paymentMode() !== "online" ? this.paymentMode() : "");
  readonly effectiveDiscount = computed<number>(() => Math.max(0, Number(this.discountTotal() || 0)) + this.localDiscount());
  readonly effectiveTotal = computed<number>(() => Math.max(0, Number(this.total() || 0) - this.localDiscount()));
  // Chỉ thanh toán tại phòng khám mới yêu cầu đặt cọc 30%; trực tuyến thanh toán toàn bộ
  readonly depositAmount = computed<number>(() => this.online() ? 0 : Math.round(this.effectiveTotal() * 0.30));
  readonly balanceAtClinic = computed<number>(() => Math.max(0, this.effectiveTotal() - this.depositAmount()));

  protected async handleApplyCoupon() {
    const code = String(this.couponCode() || '').trim().toUpperCase();
    if (!code) {
      this.couponError.set('Vui lòng nhập mã giảm giá');
      return;
    }

    const ids = [...new Set((this.serviceIds() || []).filter(Boolean))];
    if (!ids.length || !this.branchId()) {
      this.couponError.set('Vui lòng chọn dịch vụ và chi nhánh trước khi áp dụng mã.');
      return;
    }

    this.clearAppliedVoucher();
    this.couponError.set('');
    this.applyingVoucher.set(true);
    const requestId = ++this.applyRequestId;
    const context = this.voucherContext();

    try {
      const result = await this.loyaltyApi.applyVoucher({
        code,
        orderValue: Number(this.subtotal() || 0),
        serviceIds: ids,
        branchId: this.branchId(),
      });
      if (requestId !== this.applyRequestId || context !== this.voucherContext()) return;
      const discount = Number(result?.discount ?? result?.discountAmount ?? 0);
      if (result?.valid !== true || !Number.isFinite(discount) || discount <= 0) {
        throw new Error('DISCOUNT_NOT_AVAILABLE');
      }
      this.localDiscount.set(discount);
      this.appliedContext = context;
      this.onVoucherChange.emit(code);
      this.couponSuccess.set(`Đã áp dụng giảm ${formatMoney(discount)}`);
    } catch (err: any) {
      if (requestId !== this.applyRequestId) return;
      const reason = String(err?.message || '').toUpperCase();
      const messages: Record<string,string> = {
        NOT_FOUND: 'Mã giảm giá không tồn tại.',
        INACTIVE: 'Mã giảm giá chưa được kích hoạt.',
        NOT_STARTED: 'Mã giảm giá chưa đến thời gian áp dụng.',
        EXPIRED: 'Mã giảm giá đã hết hạn.',
        QUOTA_EXCEEDED: 'Mã giảm giá đã hết lượt sử dụng.',
        SCOPE_MISMATCH: 'Mã giảm giá không áp dụng cho dịch vụ đã chọn.',
        MIN_CONDITION_NOT_MET: 'Đơn đặt lịch chưa đạt mức tối thiểu của mã giảm giá.',
        DISCOUNT_NOT_AVAILABLE: 'Mã giảm giá hiện không tạo ra ưu đãi.',
        FLASH_SALE_NOT_STARTED: 'Chương trình ưu đãi chưa bắt đầu.',
        FLASH_SALE_EXPIRED: 'Chương trình ưu đãi đã kết thúc.',
      };
      this.couponError.set(messages[reason] || 'Không thể kiểm tra mã giảm giá. Vui lòng thử lại.');
    } finally {
      if (requestId === this.applyRequestId) this.applyingVoucher.set(false);
    }
  }

  protected selectPaymentMode(mode: any) {
    this.setPaymentMode()(mode);
    this.paymentError.set("");
  }

  protected handleConfirm() {
    if (this.applyingVoucher()) return;
    if (this.online() && !this.selectedMethod()) {
      this.paymentError.set("Vui lòng chọn phương thức thanh toán trực tuyến");
      return;
    }

    this.onConfirm.emit();
  }

  protected handle1(e: any) {
    this.couponCode.set(e.target.value.toUpperCase());
    this.clearAppliedVoucher();
    this.couponError.set("");
  }
}

import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';

import { DecisionModalService } from '../../../../core/customer/services/decision-modal.service';
import { CustomerNavigationService } from '../../../../core/customer/services/customer-navigation.service';
import { OrderApiService } from '../../../../core/customer/services/api/order-api.service';
import { CustomerLinkDirective } from '../../../../shared/customer/directives/customer-link.directive';
import { formatCurrency, getOrderSubtotal, ORDERS } from '../data/order-data';

/** Lý do trả hàng có sẵn (mục 1). "other" = khách tự nhập. */
export const RETURN_REASONS = [
  { key: 'expired', label: 'Sản phẩm hết hạn / cận hạn' },
  { key: 'damaged', label: 'Hàng lỗi / hư hỏng / móp méo trong quá trình vận chuyển' },
  { key: 'wrong_item', label: 'Giao sai sản phẩm / kích thước' },
  { key: 'missing', label: 'Nhận thiếu hàng' },
];

/** Các bước xử lý hiển thị ở cột bên phải. */
export const REFUND_STEPS = [
  { title: 'Gửi yêu cầu', description: 'Chọn sản phẩm, số lượng, lý do và gửi thông tin' },
  { title: 'Tiếp nhận & Hỗ trợ', description: "Dr. Pets House sẽ tiếp nhận yêu cầu, xem xét và đề xuất phương án xử lý" },
  { title: 'Trả hàng', description: 'Gửi đơn vị vận chuyển hoặc mang đến chi nhánh' },
  { title: 'Kiểm tra hàng hoàn', description: 'Kiểm tra hàng hoàn, quyết định số lượng và số tiền được hoàn trả' },
  { title: 'Hoàn tiền', description: 'Kiểm tra tài khoản ngân hàng hoặc Coupon của bạn' },
];

const MIN_EVIDENCE = 2;
const MAX_EVIDENCE = 5;
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'video/mp4'];

interface EvidenceFile {
  id: string;
  file: File;
  previewUrl: string;
  isVideo: boolean;
}

/**
 * RefundRequestPage — gửi yêu cầu trả hàng hoàn tiền cho một đơn hàng.
 * Vào từ nút "Yêu cầu trả hàng hoàn tiền" ở trang chi tiết đơn hàng.
 * Form chi tiết (lý do, mô tả, minh chứng, phương thức) chỉ hiện khi đã chọn ít nhất 1 sản phẩm.
 */
@Component({
  selector: 'app-refund-request-page',
  standalone: true,
  imports: [CustomerLinkDirective],
  templateUrl: './refund-request-page.component.html',
  styleUrl: './refund-request-page.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RefundRequestPageComponent {
  protected readonly decisionModalService = inject(DecisionModalService);
  protected readonly navService = inject(CustomerNavigationService);
  protected readonly orderApi = inject(OrderApiService);

  protected readonly formatCurrency: any = formatCurrency;
  protected readonly RETURN_REASONS = RETURN_REASONS;
  protected readonly REFUND_STEPS = REFUND_STEPS;
  protected readonly MAX_EVIDENCE = MAX_EVIDENCE;

  readonly order = signal<any>(null);
  readonly isLoading = signal<boolean>(true);
  readonly loadError = signal<string>('');
  /** Số lượng trả theo id sản phẩm trong đơn. 0 = chưa chọn. */
  readonly returnQty = signal<Record<string, number>>({});
  readonly reason = signal<string>('');
  readonly otherReason = signal<string>('');
  readonly description = signal<string>('');
  readonly evidence = signal<EvidenceFile[]>([]);
  readonly returnMethod = signal<'pickup' | 'store'>('pickup');
  readonly pickupAddress = signal<any>({ name: '', phone: '', address: '' });
  readonly editingAddress = signal<boolean>(false);
  readonly isDragging = signal<boolean>(false);
  readonly submitting = signal<boolean>(false);
  readonly submitted = signal<boolean>(false);
  readonly fileError = signal<string>('');
  readonly submitError = signal<string>('');

  readonly orderId = computed(() => this.navService.params()['orderId']);
  readonly products = computed<any[]>(() => Array.isArray(this.order()?.products) ? this.order().products : []);
  readonly canRequest = computed(() => this.order()?.status === 'delivered');
  readonly hasSelection = computed(() => Object.values(this.returnQty()).some((qty) => qty > 0));
  readonly allSelected = computed(() => this.products().length > 0 && this.products().every((p) => this.qtyOf(p) > 0));

  /** Tỷ lệ giá sau giảm giá: giảm giá của đơn được chia đều theo giá trị sản phẩm. */
  readonly discountRatio = computed(() => {
    const subtotal = getOrderSubtotal(this.order());
    if (!subtotal) return 1;
    return Math.max(0, subtotal - Number(this.order()?.discount || 0)) / subtotal;
  });
  readonly totalRefund = computed(() => this.products().reduce((sum, p) => sum + this.refundOf(p), 0));
  readonly refundMethodLabel = computed(() =>
    this.order()?.paymentMethod === 'Thanh toán trực tuyến' ? 'Thẻ/Ví' : 'Tiền mặt');

  readonly errors = computed(() => {
    const errors: Record<string, string> = {};
    if (!this.reason()) errors['reason'] = 'Vui lòng chọn lý do trả hàng.';
    else if (this.reason() === 'other' && !this.otherReason().trim()) errors['reason'] = 'Vui lòng nhập lý do trả hàng.';
    if (this.description().trim().length < 10) errors['description'] = 'Vui lòng mô tả chi tiết vấn đề (tối thiểu 10 ký tự).';
    if (this.evidence().length < MIN_EVIDENCE) errors['evidence'] = `Vui lòng tải lên tối thiểu ${MIN_EVIDENCE} ảnh/video minh chứng.`;
    const address = this.pickupAddress();
    if (this.returnMethod() === 'pickup' && (!address.name?.trim() || !address.phone?.trim() || !address.address?.trim())) {
      errors['address'] = 'Vui lòng nhập đầy đủ thông tin địa chỉ nhận hàng.';
    }
    return errors;
  });

  constructor() {
    effect((onCleanup) => {
      const orderId = this.orderId();
      let active = true;
      untracked(() => {
        this.isLoading.set(true);
        this.loadError.set('');
        this.orderApi.getOrderDetails(orderId)
          .then((detail: any) => {
            if (active) this.setOrder(detail);
          })
          .catch((error: any) => {
            if (!active) return;
            const fallbackOrder = ORDERS.find((item: any) => String(item.id) === String(orderId)) || null;
            this.setOrder(fallbackOrder);
            this.loadError.set(error?.message || 'Không thể tải đơn hàng, đang hiển thị dữ liệu mẫu.');
          })
          .finally(() => {
            if (active) this.isLoading.set(false);
          });
      });
      onCleanup(() => { active = false; });
    });

    // Giải phóng URL xem trước ảnh khi rời trang
    inject(DestroyRef).onDestroy(() => {
      this.evidence().forEach((item) => URL.revokeObjectURL(item.previewUrl));
    });
  }

  private setOrder(order: any) {
    this.order.set(order);
    this.returnQty.set({});
    this.pickupAddress.set({
      name: order?.recipient?.name || '',
      phone: order?.recipient?.phone || '',
      address: order?.recipient?.address && order.recipient.address !== 'Tại cửa hàng' ? order.recipient.address : '',
    });
  }

  /** "Thứ bảy, 10/10/2026" */
  protected formatDate(value: any): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const text = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  protected qtyOf(product: any): number {
    return this.returnQty()[product.id] || 0;
  }

  protected refundOf(product: any): number {
    return Math.round(Number(product.price || 0) * this.qtyOf(product) * this.discountRatio());
  }

  protected setQty(product: any, qty: number) {
    const max = Number(product.quantity || 1);
    const next = Math.min(max, Math.max(0, qty));
    this.returnQty.update((current) => ({ ...current, [product.id]: next }));
  }

  protected toggleProduct(product: any) {
    this.setQty(product, this.qtyOf(product) > 0 ? 0 : 1);
  }

  protected toggleAll() {
    if (this.allSelected()) {
      this.returnQty.set({});
      return;
    }
    this.returnQty.set(Object.fromEntries(this.products().map((p) => [p.id, Number(p.quantity || 1)])));
  }

  protected updateAddress(field: 'name' | 'phone' | 'address', value: string) {
    this.pickupAddress.update((current: any) => ({ ...current, [field]: value }));
  }

  protected onFileInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.addFiles(Array.from(input.files || []));
    input.value = '';
  }

  protected onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(false);
    this.addFiles(Array.from(event.dataTransfer?.files || []));
  }

  protected onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(true);
  }

  private addFiles(files: File[]) {
    this.fileError.set('');
    const accepted: EvidenceFile[] = [];
    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        this.fileError.set(`"${file.name}" không đúng định dạng (chỉ nhận JPG, PNG, MP4).`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        this.fileError.set(`"${file.name}" vượt quá dung lượng 25MB.`);
        continue;
      }
      if (this.evidence().length + accepted.length >= MAX_EVIDENCE) {
        this.fileError.set(`Chỉ được tải lên tối đa ${MAX_EVIDENCE} tệp.`);
        break;
      }
      accepted.push({
        id: `${file.name}-${file.size}-${Date.now()}-${accepted.length}`,
        file,
        previewUrl: URL.createObjectURL(file),
        isVideo: file.type.startsWith('video/'),
      });
    }
    if (accepted.length) this.evidence.update((current) => [...current, ...accepted]);
  }

  protected removeFile(item: EvidenceFile) {
    URL.revokeObjectURL(item.previewUrl);
    this.evidence.update((current) => current.filter((f) => f.id !== item.id));
  }

  protected async handleSubmit() {
    this.submitted.set(true);
    this.submitError.set('');
    if (!this.canRequest() || !this.hasSelection() || Object.keys(this.errors()).length) return;

    const reasonLabel = this.reason() === 'other'
      ? this.otherReason().trim()
      : RETURN_REASONS.find((r) => r.key === this.reason())?.label || '';

    this.submitting.set(true);
    try {
      await this.orderApi.createReturnRequest(this.order().id, {
        items: this.products()
          .filter((p) => this.qtyOf(p) > 0)
          .map((p) => ({ orderItemId: p.id, quantity: this.qtyOf(p) })),
        reason: reasonLabel,
        description: this.description().trim(),
        returnMethod: this.returnMethod(),
        pickupAddress: this.returnMethod() === 'pickup' ? this.pickupAddress() : null,
        files: this.evidence().map((item) => item.file),
      });
      this.decisionModalService.showSuccessModal({
        message: 'Đã gửi yêu cầu trả hàng hoàn tiền.\nDr. Pets House sẽ liên hệ với bạn trong thời gian sớm nhất',
      });
      this.navService.navigate(`/don-hang-cua-toi/${this.order().id}`);
    } catch (error: any) {
      this.submitError.set(error?.message || 'Không thể gửi yêu cầu lúc này. Vui lòng thử lại sau.');
    } finally {
      this.submitting.set(false);
    }
  }
}

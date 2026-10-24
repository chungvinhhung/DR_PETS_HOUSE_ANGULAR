import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Observable, finalize, map } from 'rxjs';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminToastService, adminErrorMessage } from '../../../../shared/services/admin-toast.service';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import {
  AdminOrder, AdminOrderReturnApiService, AdminReturn, AdminRefund,
  ReturnQuote, ReturnQuantity, ReturnableResponse,
} from './admin-order-return-api.service';

@Component({
  selector: 'app-admin-orders-page',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminCatalogShellComponent],
  templateUrl: './admin-orders-page.component.html',
  styleUrl: './admin-orders-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOrdersPageComponent implements OnInit {
  private readonly api = inject(AdminOrderReturnApiService);
  private readonly toast = inject(AdminToastService);
  private readonly session = inject(AuthSessionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly tab = signal<'orders' | 'returns'>('orders');
  readonly orders = signal<AdminOrder[]>([]);
  readonly returns = signal<AdminReturn[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly selectedOrder = signal<AdminOrder | null>(null);
  readonly returnable = signal<ReturnableResponse | null>(null);
  readonly quantities = signal<Record<string, number>>({});
  readonly reason = signal('');
  readonly quote = signal<ReturnQuote | null>(null);
  readonly previewLoading = signal(false);
  readonly saving = signal(false);
  readonly selectedReturn = signal<AdminReturn | null>(null);
  readonly refund = signal<AdminRefund | null>(null);
  readonly rejectionReason = signal('');
  readonly confirmMockRefund = signal(false);
  private quoteKey = '';
  private createKey = '';

  get canApprove(): boolean {
    return this.session.hasAnyRole(['ADMIN', 'MANAGER']);
  }

  ngOnInit(): void { this.load(); }

  money(value: number | null | undefined): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND',
      maximumFractionDigits: 0 }).format(value ?? 0);
  }
  date(value: string | null | undefined): string {
    return value ? new Date(value).toLocaleString('vi-VN') : '—';
  }
  statusLabel(status: string): string {
    return ({
      PENDING: 'Chờ xử lý', CONFIRMED: 'Đã xác nhận', PROCESSING: 'Đang xử lý',
      SHIPPED: 'Đang giao', DELIVERED: 'Đã giao', COMPLETED: 'Hoàn tất',
      CANCELLED: 'Đã hủy', REQUESTED: 'Yêu cầu mới', RECEIVED: 'Đã nhận hàng',
      APPROVED: 'Đã duyệt', REJECTED: 'Đã từ chối', REFUNDED: 'Đã hoàn (mô phỏng)',
    } as Record<string, string>)[status] ?? status;
  }
  switchTab(next: 'orders' | 'returns'): void {
    this.tab.set(next); this.closeModal(); this.load();
  }
  load(): void {
    this.loading.set(true);
    this.error.set('');
    const request: Observable<{ kind: 'orders'; items: AdminOrder[] } | { kind: 'returns'; items: AdminReturn[] }> =
      this.tab() === 'orders'
        ? this.api.listOrders().pipe(map(data => ({ kind: 'orders' as const, items: data.items })))
        : this.api.listReturns().pipe(map(data => ({ kind: 'returns' as const, items: data.items })));
    request.pipe(takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false))).subscribe({
      next: (data) => {
        if (data.kind === 'orders') this.orders.set(data.items);
        else this.returns.set(data.items);
      },
      error: (error: unknown) => {
        this.error.set(adminErrorMessage(error, 'Không tải được dữ liệu. Vui lòng thử lại.'));
      },
    });
  }
  openReturn(order: AdminOrder): void {
    this.selectedOrder.set(order);
    this.selectedReturn.set(null);
    this.returnable.set(null);
    this.quantities.set({});
    this.reason.set('');
    this.quote.set(null);
    this.quoteKey = '';
    this.createKey = '';
    this.previewLoading.set(true);
    this.api.returnableItems(order.id).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.previewLoading.set(false)),
    ).subscribe({
      next: value => this.returnable.set(value),
      error: error => this.toast.show(adminErrorMessage(error, 'Không kiểm tra được điều kiện trả hàng.'), 'error'),
    });
  }
  closeModal(): void {
    if (this.saving()) return;
    this.selectedOrder.set(null); this.selectedReturn.set(null);
    this.returnable.set(null); this.quote.set(null);
    this.refund.set(null); this.confirmMockRefund.set(false);
  }
  returnableQuantity(itemId: string): number {
    return this.returnable()?.items.find(item => item.orderItemId === itemId)?.returnableQty ?? 0;
  }
  setQuantity(itemId: string, raw: string): void {
    const requested = raw.trim() ? Number(raw) : 0;
    const max = this.returnable()?.items.find(item => item.orderItemId === itemId)?.returnableQty ?? 0;
    const qty = Number.isInteger(requested) ? Math.max(0, Math.min(requested, max)) : 0;
    this.quantities.update(old => ({ ...old, [itemId]: qty }));
    this.quote.set(null);
    this.quoteKey = ''; this.createKey = '';
  }
  setReason(value: string): void {
    this.reason.set(value);
    this.createKey = '';
  }
  selectedLines(): ReturnQuantity[] {
    return Object.entries(this.quantities()).filter(([, qty]) => qty > 0)
      .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
  }
  requestQuote(): void {
    const order = this.selectedOrder();
    const items = this.selectedLines();
    if (!order || !this.returnable()?.eligible || !items.length) {
      this.toast.show('Vui lòng chọn sản phẩm và số lượng hợp lệ để trả hàng.', 'error');
      return;
    }
    this.previewLoading.set(true);
    this.quote.set(null);
    this.quoteKey = '';
    this.api.returnQuote(order.id, items).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.previewLoading.set(false)),
    ).subscribe({
      next: quote => {
        this.quote.set(quote);
        this.quoteKey = JSON.stringify(items);
      },
      error: error => this.toast.show(adminErrorMessage(error, 'Không lấy được số tiền hoàn dự kiến.'), 'error'),
    });
  }
  createReturn(): void {
    const order = this.selectedOrder();
    const items = this.selectedLines();
    const quote = this.quote();
    if (!order || !quote || JSON.stringify(items) !== this.quoteKey) {
      this.toast.show('Vui lòng xem báo giá hoàn tiền mới nhất trước khi gửi.', 'error');
      return;
    }
    if (this.reason().trim().length < 3) {
      this.toast.show('Vui lòng nhập lý do trả hàng từ 3 ký tự.', 'error');
      return;
    }
    if (this.saving()) return;
    this.createKey ||= crypto.randomUUID();
    this.saving.set(true);
    this.api.createReturn(order.id, items, this.reason().trim(), this.createKey).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.saving.set(false)),
    ).subscribe({
      next: () => {
        this.toast.show('Đã tiếp nhận yêu cầu trả hàng.', 'success');
        this.selectedOrder.set(null);
        this.returnable.set(null);
        this.quote.set(null);
        this.tab.set('returns');
        this.load();
      },
      error: error => this.toast.show(adminErrorMessage(error, 'Không gửi được yêu cầu trả hàng.'), 'error'),
    });
  }
  openReturnDetails(value: AdminReturn): void {
    this.selectedReturn.set(value); this.selectedOrder.set(null);
    this.refund.set(null); this.rejectionReason.set('');
    this.confirmMockRefund.set(false);
    if (value.refundId && this.canApprove) {
      this.api.getRefund(value.refundId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: refund => this.refund.set(refund),
        error: () => this.toast.show('Chưa tải được thông tin hoàn tiền.', 'info'),
      });
    }
  }
  doReturnAction(action: 'process' | 'receive' | 'approve' | 'reject'): void {
    const value = this.selectedReturn();
    if (!value || this.saving()) return;
    if ((action === 'approve' || action === 'reject') && !this.canApprove) {
      this.toast.show('Tài khoản không có quyền duyệt yêu cầu trả hàng.', 'error');
      return;
    }
    if (action === 'reject' && this.rejectionReason().trim().length < 3) {
      this.toast.show('Vui lòng nhập lý do từ chối từ 3 ký tự.', 'error');
      return;
    }
    const requests: Record<typeof action, () => Observable<AdminReturn>> = {
      process: () => this.api.processReturn(value.id),
      receive: () => this.api.receiveReturn(value.id),
      approve: () => this.api.approveReturn(value.id),
      reject: () => this.api.rejectReturn(value.id, this.rejectionReason().trim()),
    };
    this.saving.set(true);
    requests[action]().pipe(takeUntilDestroyed(this.destroyRef),
      finalize(() => this.saving.set(false))).subscribe({
      next: result => {
        this.selectedReturn.set(result);
        this.toast.show('Đã cập nhật yêu cầu trả hàng.', 'success');
        this.load();
        if (result.refundId && this.canApprove) {
          this.api.getRefund(result.refundId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: refund => this.refund.set(refund),
          });
        }
      },
      error: error => this.toast.show(adminErrorMessage(error, 'Không cập nhật được yêu cầu trả hàng.'), 'error'),
    });
  }
  processRefund(): void {
    const refund = this.refund();
    if (!refund || refund.status !== 'PENDING' || !this.canApprove || this.saving() || !this.confirmMockRefund()) return;
    this.saving.set(true);
    const key = crypto.randomUUID();
    this.api.processMockRefund(refund.id, key).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.saving.set(false)),
    ).subscribe({
      next: next => {
        this.refund.set(next);
        this.confirmMockRefund.set(false);
        this.toast.show('Đã ghi nhận hoàn tiền mô phỏng. Chưa chuyển tiền thật.', 'success');
        this.load();
      },
      error: error => this.toast.show(adminErrorMessage(error, 'Không xử lý được hoàn tiền mô phỏng.'), 'error'),
    });
  }
}

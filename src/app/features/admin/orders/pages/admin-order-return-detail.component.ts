import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminToastService } from '../../../../shared/services/admin-toast.service';
import { AdminReturnNotificationService } from '../../../../shared/services/admin-return-notification.service';
import { orderErrorMessage } from '../services/admin-order-error-message';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import {
  AdminOrderApiService, OrderReturnSummary, OrderRefundRecord, ReturnStatus,
  ReturnStaffAction, ReturnManagerAction,
} from '../services/admin-order-api.service';

type WorkflowAction = ReturnStaffAction | ReturnManagerAction | 'refund';
const RETURN_LABELS: Record<ReturnStatus, string> = {
  REQUESTED: 'Chờ tiếp nhận',
  PROCESSING: 'Đang xử lý',
  RECEIVED: 'Đã nhận hàng',
  APPROVED: 'Đã duyệt hoàn',
  REJECTED: 'Đã từ chối',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
};
@Component({
  selector: 'app-admin-order-return-detail',
  standalone: true,
  imports: [AdminCatalogShellComponent, RouterLink],
  templateUrl: './admin-order-return-detail.component.html',
  styleUrl: './admin-order-return-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOrderReturnDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(AdminOrderApiService);
  private readonly session = inject(AuthSessionService);
  private readonly toast = inject(AdminToastService);
  private readonly returnNotifications = inject(AdminReturnNotificationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly id = signal('');
  readonly data = signal<OrderReturnSummary | null>(null);
  readonly refund = signal<OrderRefundRecord | null>(null);
  readonly loading = signal(true);
  readonly refundLoading = signal(false);
  readonly error = signal('');
  readonly dialog = signal<WorkflowAction | null>(null);
  readonly busy = signal(false);
  readonly note = signal('');
  readonly evidencePreview = signal<string | null>(null);
  readonly statusSteps: ReturnStatus[] = ['REQUESTED', 'PROCESSING', 'RECEIVED', 'APPROVED', 'COMPLETED'];

  readonly isManager = computed(() => {
    const role = this.session.user()?.systemRole;
    return role === 'ADMIN' || role === 'MANAGER';
  });
  readonly canStaff = computed(() => {
    const u = this.session.user();
    return this.isManager() || (u?.systemRole === 'STAFF' && u.staffSubRole === 'RECEPTIONIST');
  });
  readonly availableActions = computed<WorkflowAction[]>(() => {
    const r = this.data();
    if (!r) return [];
    if (r.status === 'REQUESTED' && this.canStaff()) return ['process'];
    if (r.status === 'PROCESSING') return [
      ...(this.canStaff() ? ['receive' as WorkflowAction] : []),
      ...(this.isManager() ? ['reject' as WorkflowAction] : []),
    ];
    if (r.status === 'RECEIVED' && this.isManager()) return ['approve','reject'];
    if (r.status === 'APPROVED' && this.isManager() && r.refundId && this.refund()?.status === 'PENDING') return ['refund'];
    return [];
  });
  readonly totalQuantity = computed(() => this.data()?.items.reduce((sum, item) => sum + item.requestedQty, 0) ?? 0);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const id = params.get('id') ?? '';
      this.id.set(id);
      this.data.set(null);
      this.refund.set(null);
      this.dialog.set(null);
      this.load();
    });
  }
  load(): void {
    const id = this.id();
    if (!id) { this.loading.set(false); this.error.set('Thiếu mã yêu cầu trả hàng.'); return; }
    this.loading.set(true); this.error.set('');
    this.api.getReturn(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: value => {
        if (this.id() !== id) return;
        this.data.set(value);
        this.loading.set(false);
        this.refreshRefund(value);
      },
      error: err => {
        if (this.id() !== id) return;
        this.data.set(null); this.loading.set(false);
        this.error.set(orderErrorMessage(err, 'Không tải được chi tiết yêu cầu trả hàng.'));
      },
    });
  }
  private refreshRefund(data: OrderReturnSummary): void {
    if (!data.refundId || !this.isManager()) { this.refund.set(null); return; }
    this.refundLoading.set(true);
    this.api.getRefund(data.refundId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: value => {
        if (this.id() === data.id) this.refund.set(value);
        this.refundLoading.set(false);
      },
      error: err => {
        if (this.id() === data.id) this.toast.show(orderErrorMessage(err, 'Không đọc được trạng thái giao dịch hoàn tiền.'), 'error');
        this.refundLoading.set(false);
      },
    });
  }
  label(status: ReturnStatus | string): string { return RETURN_LABELS[status as ReturnStatus] ?? status; }
  finalRefundAmount(): number | null {
    const ret = this.data();
    if (!ret || ret.status !== 'COMPLETED') return null;
    // Read settled refund amount when available, falling back to this BE's
    // approved amount only because processOrderRefund settles that exact value.
    const settled = this.refund();
    const amount = settled?.status === 'REFUNDED'
      ? settled.amount : (ret.finalRefundAmount ?? ret.refundBreakdown?.total);
    return typeof amount === 'number' && Number.isFinite(amount) && amount >= 0
      ? amount : null;
  }
  money(value?: number | null): string {
    return typeof value === 'number' && Number.isFinite(value)
      ? new Intl.NumberFormat('vi-VN').format(value) + 'đ' : '—';
  }
  when(value?: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit',
      day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(d);
  }
  actionName(action: WorkflowAction): string {
    return ({ process: 'Tiếp nhận yêu cầu', receive: 'Xác nhận đã nhận hàng',
      approve: 'Phê duyệt hoàn tiền', reject: 'Từ chối yêu cầu',
      refund: 'Xác nhận hoàn tiền' })[action];
  }
  actionExplanation(action: WorkflowAction): string {
    return ({
      process: 'Yêu cầu chuyển sang Đang xử lý. Chưa tiếp nhận hàng thực tế.',
      receive: 'Xác nhận chi nhánh đã nhận và kiểm tra sản phẩm khách gửi. Việc nhận hàng KHÔNG tự động nhập lại tồn kho.',
      approve: 'Phê duyệt số tiền hoàn dựa trên số tiền thực trả sau giảm giá. Khoản hoàn sẽ được xử lý ở bước tiếp theo.',
      reject: 'Yêu cầu sẽ bị từ chối và BE giải phóng số lượng trả hàng đã giữ. Vui lòng ghi lý do rõ ràng.',
      refund: 'Xác nhận hoàn tiền trong môi trường mô phỏng. Thao tác này không chuyển tiền thật cho khách hàng.',
    })[action];
  }
  open(action: WorkflowAction): void {
    if (!this.availableActions().includes(action) || this.busy()) return;
    this.note.set('');
    this.dialog.set(action);
  }
  close(): void { if (!this.busy()) this.dialog.set(null); }
  submit(): void {
    const action = this.dialog(), data = this.data();
    if (!action || !data || this.busy() || !this.availableActions().includes(action)) return;
    if (action === 'reject' && this.note().trim().length < 5) return;
    this.busy.set(true);
    const request: Observable<unknown> = action === 'refund'
      ? this.api.processRefund(data.refundId!, 'order-refund-' + data.refundId)
      : action === 'approve' || action === 'reject'
        ? this.api.returnManagerAction(data.id, action as ReturnManagerAction,
          action === 'approve' ? { note: this.note().trim() } : { reason: this.note().trim() })
        : this.api.returnStaffAction(data.id, action as ReturnStaffAction);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.busy.set(false); this.dialog.set(null);
        this.toast.show('Đã cập nhật yêu cầu trả hàng thành công.', 'success');
        this.returnNotifications.refresh();
        this.load();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.toast.show(orderErrorMessage(err, 'Không thể xử lý yêu cầu. Vui lòng kiểm tra trạng thái mới nhất.'), 'error');
        this.load();
      },
    });
  }
  isEvidenceUrl(url: string): boolean {
    try { const u = new URL(url); return u.protocol === 'https:' || u.protocol === 'http:'; }
    catch { return false; }
  }
  showEvidence(url: string): void { if (this.isEvidenceUrl(url)) this.evidencePreview.set(url); }
  closeEvidence(): void { this.evidencePreview.set(null); }
}

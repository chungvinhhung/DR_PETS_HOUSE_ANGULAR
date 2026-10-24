import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminToastService, adminErrorMessage } from '../../../../shared/services/admin-toast.service';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { BranchManagementApiService } from '../../branch-management/services/branch-management-api.service';
import {
  AdminOrderApiService, OrderRecord, OrderStatus, OrderWriteAction,
} from '../services/admin-order-api.service';

type OrderFilter = OrderStatus | 'ALL';
type ActionDialog = OrderWriteAction | 'cancel' | null;
const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PROCESSING: 'Đang chuẩn bị',
  SHIPPED: 'Đang giao',
  COMPLETED: 'Đã giao',
  CANCELLED: 'Đã hủy',
};

@Component({
  selector: 'app-admin-order-management',
  standalone: true,
  imports: [AdminCatalogShellComponent, RouterLink],
  templateUrl: './admin-order-management.component.html',
  styleUrl: './admin-order-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOrderManagementComponent {
  private readonly api = inject(AdminOrderApiService);
  private readonly branchApi = inject(BranchManagementApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(AuthSessionService);
  private readonly toast = inject(AdminToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly statuses = STATUS_LABELS;
  readonly milestones: OrderStatus[] = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'COMPLETED'];
  readonly orderId = signal('');
  readonly isDetail = computed(() => Boolean(this.orderId()));
  readonly allOrders = signal<OrderRecord[]>([]);
  readonly selected = signal<OrderRecord | null>(null);
  readonly branches = signal<{ id: string; name: string }[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly search = signal('');
  readonly status = signal<OrderFilter>('ALL');
  readonly branchId = signal('ALL');
  readonly page = signal(1);
  readonly pageSize = 6;
  readonly dialog = signal<ActionDialog>(null);
  readonly dialogBusy = signal(false);
  readonly reason = signal('');
  readonly carrier = signal('');
  readonly tracking = signal('');
  readonly detailInfo = computed(() => this.selected());

  readonly rows = computed(() => {
    const query = this.search().trim().toLocaleLowerCase('vi');
    return this.allOrders().filter((row) => {
      const customer = this.customerName(row).toLocaleLowerCase('vi');
      return (!query || [row.code, customer, row.contactSnapshot?.phone ?? ''].some((v) => v.toLocaleLowerCase('vi').includes(query))) &&
        (this.status() === 'ALL' || row.status === this.status()) &&
        (this.branchId() === 'ALL' || row.fulfillmentBranchId === this.branchId());
    });
  });
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.rows().length / this.pageSize)));
  readonly pageRows = computed(() => this.rows().slice((this.page() - 1) * this.pageSize, this.page() * this.pageSize));
  readonly canManage = computed(() => {
    const user = this.session.user();
    return user?.systemRole === 'ADMIN' || user?.systemRole === 'MANAGER' ||
      (user?.systemRole === 'STAFF' && user.staffSubRole === 'RECEPTIONIST');
  });
  readonly availableAction = computed<OrderWriteAction | null>(() => {
    if (!this.canManage()) return null;
    switch (this.selected()?.status) {
      case 'PENDING': return 'confirm';
      case 'CONFIRMED': return 'process';
      case 'PROCESSING': return 'ship';
      case 'SHIPPED': return 'mark-delivered';
      default: return null;
    }
  });
  readonly canCancel = computed(() => this.canManage() &&
    (this.selected()?.status === 'PENDING' || this.selected()?.status === 'CONFIRMED' || this.selected()?.status === 'PROCESSING'));

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.orderId.set(params.get('id') ?? '');
      this.dialog.set(null);
      if (this.isDetail()) this.loadDetail();
      else this.loadOrders();
    });
    this.branchApi.listBranches().pipe(takeUntilDestroyed()).subscribe({
      next: (records) => this.branches.set(records.map((branch) => ({ id: branch.id, name: branch.name }))),
      error: () => { /* Branch titles are optional; Order API remains authoritative. */ },
    });
  }

  setSearch(value: string): void { this.search.set(value); this.page.set(1); }
  setStatus(value: string): void {
    if (value === 'ALL' || value in STATUS_LABELS) {
      this.status.set(value as OrderFilter); this.page.set(1);
    }
  }
  setBranch(value: string): void { this.branchId.set(value); this.page.set(1); }
  changePage(next: number): void {
    if (next >= 1 && next <= this.totalPages()) this.page.set(next);
  }
  clearFilters(): void {
    this.search.set(''); this.status.set('ALL'); this.branchId.set('ALL'); this.page.set(1);
  }
  refresh(): void { if (this.isDetail()) this.loadDetail(); else this.loadOrders(); }

  private loadOrders(): void {
    this.loading.set(true); this.error.set('');
    this.api.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (page) => {
        this.allOrders.set(Array.isArray(page.items) ? page.items : []);
        this.page.set(1); this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false); this.allOrders.set([]);
        this.error.set(adminErrorMessage(error, 'Không tải được danh sách đơn hàng.'));
      },
    });
  }
  private loadDetail(): void {
    const id = this.orderId();
    if (!id) return;
    this.loading.set(true); this.error.set('');
    this.selected.set(null);
    this.api.get(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (order) => {
        if (this.orderId() !== id) return;
        this.selected.set(order); this.loading.set(false);
      },
      error: (error: unknown) => {
        if (this.orderId() !== id) return;
        this.error.set(adminErrorMessage(error, 'Không tải được chi tiết đơn hàng.'));
        this.loading.set(false);
      },
    });
  }

  statusLabel(status: OrderStatus): string { return STATUS_LABELS[status] ?? 'Chưa xác định'; }
  customerName(order: OrderRecord): string {
    return order.contactSnapshot?.fullName || order.contactSnapshot?.name || 'Khách hàng';
  }
  branchName(id: string): string {
    return this.branches().find((b) => b.id === id)?.name ?? 'Chưa có tên chi nhánh';
  }
  price(value?: number | null): string {
    return typeof value === 'number' && Number.isFinite(value)
      ? new Intl.NumberFormat('vi-VN').format(value) + 'đ' : '—';
  }
  when(value?: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric',
    }).format(date);
  }
  contact(order: OrderRecord): string {
    return order.contactSnapshot?.phone || 'Chưa có số liên hệ';
  }
  paymentLabel(order: OrderRecord): string {
    return order.paymentMethod === 'COD' ? 'Thanh toán khi nhận hàng (COD)' : 'Thanh toán trực tuyến (mô phỏng)';
  }
  paymentStatus(order: OrderRecord): string {
    const status = order.payment?.status;
    if (status === 'PAID') return 'Đã thanh toán';
    if (status === 'REFUNDED') return 'Đã hoàn tiền';
    if (status === 'PENDING') return 'Chưa thanh toán';
    if (status === 'FAILED') return 'Thanh toán thất bại';
    if (status === 'CANCELLED') return 'Thanh toán đã hủy';
    return 'Chưa có dữ liệu';
  }
  shipping(order: OrderRecord): string {
    if (typeof order.shippingAddress === 'string') return order.shippingAddress;
    const record = order.shippingAddress;
    if (!record) return 'Chưa có địa chỉ';
    const parts = [record['street'], record['address'], record['ward'], record['district'], record['city']].filter((v) => typeof v === 'string' && !!v);
    return parts.length ? parts.join(', ') : 'Chưa có địa chỉ';
  }
  actionLabel(action: OrderWriteAction): string {
    return ({
      confirm: 'Xác nhận đơn hàng',
      process: 'Chuyển sang chuẩn bị hàng',
      ship: 'Xác nhận bàn giao vận chuyển',
      'mark-delivered': 'Xác nhận đã giao hàng',
    })[action];
  }
  actionDescription(action: OrderWriteAction): string {
    return ({
      confirm: 'Đơn hàng sẽ chuyển từ Chờ xác nhận sang Đã xác nhận.',
      process: 'Đơn hàng sẽ được chuyển sang giai đoạn chuẩn bị hàng.',
      ship: 'Đơn hàng sẽ chuyển sang Đang giao.',
      'mark-delivered': 'Đơn hàng sẽ hoàn tất. Với đơn COD, hệ thống sẽ cập nhật trạng thái thanh toán.',
    })[action];
  }
  openAction(action: ActionDialog): void {
    if (!this.canManage() || !action || this.dialogBusy()) return;
    if (action === 'cancel' ? !this.canCancel() : this.availableAction() !== action) return;
    this.reason.set(''); this.carrier.set(''); this.tracking.set(''); this.dialog.set(action);
  }
  closeDialog(): void { if (!this.dialogBusy()) this.dialog.set(null); }
  confirmDialog(): void {
    const action = this.dialog();
    const order = this.selected();
    if (!action || !order || this.dialogBusy() || !this.canManage()) return;
    if (action === 'cancel' && (!this.canCancel() || this.reason().trim().length < 5)) return;
    if (action !== 'cancel' && this.availableAction() !== action) return;
    this.dialogBusy.set(true);
    const request = action === 'cancel'
      ? this.api.cancel(order.id, this.reason().trim(), 'staff-cancel-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2))
      : this.api.changeStatus(order.id, action, { carrier: this.carrier().trim(), trackingNumber: this.tracking().trim() });
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => {
        this.dialogBusy.set(false); this.dialog.set(null);
        this.selected.set(updated);
        this.toast.show(action === 'cancel' ? 'Đơn hàng đã được hủy.' : 'Đã cập nhật trạng thái đơn hàng.', 'success');
        this.loadDetail();
      },
      error: (error: unknown) => {
        this.dialogBusy.set(false);
        this.toast.show(adminErrorMessage(error, 'Không thể cập nhật đơn hàng. Vui lòng thử lại.'), 'error');
        this.loadDetail();
      },
    });
  }
}

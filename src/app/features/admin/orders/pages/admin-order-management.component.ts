import { adminPageWindow } from '../../../../shared/utils/admin-table-pagination';
import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, from, map, mergeMap, of, toArray } from 'rxjs';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminBreadcrumbComponent } from '../../../../shared/admin-breadcrumb/admin-breadcrumb.component';
import { AdminDataStateComponent } from "../../../../shared/admin-data-state/admin-data-state.component";
import { AdminToastService } from '../../../../shared/services/admin-toast.service';
import { AdminReturnNotificationService } from '../../../../shared/services/admin-return-notification.service';
import { orderErrorMessage } from '../services/admin-order-error-message';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { BranchManagementApiService } from '../../branch-management/services/branch-management-api.service';
import { AdminProductService } from '../../products/services/admin-product.service';
import { AdminInventoryService, InventoryItemDto, InventoryTransactionDto } from '../../inventory/services/admin-inventory.service';
import { AdminInventoryTransactionDrawerComponent } from '../../inventory/components/admin-inventory-transaction-drawer.component';
import {
  AdminOrderApiService, OrderRecord, OrderStatus, OrderWriteAction, OrderReturnSummary, ReturnStatus,
} from '../services/admin-order-api.service';

type OrderFilter = OrderStatus | ReturnStatus | 'ALL';
const localDate = (day: Date): string => [day.getFullYear(), String(day.getMonth() + 1).padStart(2, '0'), String(day.getDate()).padStart(2, '0')].join('-');
const defaultReturnStart = (): string => { const day = new Date(); day.setDate(day.getDate() - 6); return localDate(day); };
type ActionDialog = OrderWriteAction | 'cancel' | null;
const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PROCESSING: 'Chuẩn bị hàng',
  SHIPPED: 'Đang giao',
  COMPLETED: 'Đã giao',
  CANCELLED: 'Đã hủy',
};

@Component({
  selector: 'app-admin-order-management',
  standalone: true,
  imports: [AdminCatalogShellComponent, AdminBreadcrumbComponent, AdminDataStateComponent, RouterLink, AdminInventoryTransactionDrawerComponent],
  templateUrl: './admin-order-management.component.html',
  styleUrl: './admin-order-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOrderManagementComponent {
  private readonly api = inject(AdminOrderApiService);
  private readonly branchApi = inject(BranchManagementApiService);
  private readonly inventoryApi = inject(AdminInventoryService);
  private readonly productApi = inject(AdminProductService);
  private readonly route = inject(ActivatedRoute);
  private readonly session = inject(AuthSessionService);
  private readonly toast = inject(AdminToastService);
  private readonly returnNotifications = inject(AdminReturnNotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private ordersRequestVersion = 0;
  private returnsRequestVersion = 0;
  private detailRequestVersion = 0;

  readonly statuses = STATUS_LABELS;
  readonly canCreateOrder = computed(() => {
    const user = this.session.user();
    return user?.systemRole === 'ADMIN' || user?.systemRole === 'MANAGER' ||
      (user?.systemRole === 'STAFF' && user.staffSubRole === 'RECEPTIONIST');
  });
  readonly milestones: OrderStatus[] = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'COMPLETED'];
  readonly orderId = signal('');
  readonly isDetail = computed(() => Boolean(this.orderId()));
  readonly allOrders = signal<OrderRecord[]>([]);
  readonly returns = signal<OrderReturnSummary[]>([]);
  readonly activeTab = signal<'orders' | 'returns'>('orders');
  readonly dateRange = signal('0');
  readonly returnDateFrom = signal('');
  readonly returnDateTo = signal('');
  readonly returnCalendarOpen = signal(false);
  readonly returnCalendarStart = signal<string | null>(null);
  readonly returnCalendarMonth = signal(localDate(new Date()).slice(0, 7));
  readonly returnWeekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  readonly returnCalendarDays = computed(() => {
    const [year, month] = this.returnCalendarMonth().split('-').map(Number);
    const first = new Date(year, month - 1, 1);
    const offset = (first.getDay() + 6) % 7;
    // Render only the weeks needed by this month (4–6, instead of always 6).
    const weeks = Math.ceil((offset + new Date(year, month, 0).getDate()) / 7);
    return Array.from({length: weeks * 7}, (_, i) => {
      const day = new Date(year, month - 1, 1 - offset + i);
      return {key: localDate(day), number: day.getDate(), currentMonth: day.getMonth() === month - 1};
    });
  });
  readonly returnCalendarLabel = computed(() => {
    const [year, month] = this.returnCalendarMonth().split('-').map(Number);
    return 'Tháng ' + month + '/' + year;
  });
  readonly returnBranchLookup = signal<Record<string,string|null>>({});
  // BE Return DTO includes orderId only. Resolve the actual order.code, never display a sliced Mongo ID.
  readonly returnOrderCodes = signal<Record<string,string>>({});
  readonly returnBranchResolving = signal(false);
  readonly invalidReturnDates = computed(() => Boolean(this.returnDateFrom() && this.returnDateTo() && this.returnDateFrom() > this.returnDateTo()));
  readonly returnsLoading = signal(false);
  readonly returnsError = signal('');
  readonly hasLoadedReturns = signal(false);
  // Shared with sidebar; loaded on initial page render, not when the tab is clicked.
  readonly returnPendingCount = this.returnNotifications.pendingCount;
  readonly totalLoaded = computed(() => this.allOrders().length);
  readonly awaitingCount = computed(() => this.allOrders().filter(item => item.status === 'PENDING').length);
  readonly shippingCount = computed(() => this.allOrders().filter(item => item.status === 'SHIPPED').length);
  readonly selected = signal<OrderRecord | null>(null);
  readonly orderInventory = signal<InventoryTransactionDto[]>([]);
  readonly orderInventoryLoading = signal(false);
  readonly orderInventoryError = signal(false);
  readonly inventoryDrawerOpen = signal(false);
  readonly selectedInventoryGroup = signal<InventoryTransactionDto[]>([]);
  readonly selectedInventoryCode = signal('');
  readonly orderInventoryItems = signal<InventoryItemDto[]>([]);
  readonly orderInventoryGroups = computed(() => {
    const groups = new Map<string, { key: string; code: string; rows: InventoryTransactionDto[] }>();
    for (const tx of this.orderInventory()) {
      const explicit = tx.transactionCode || tx.groupCode || tx.code || '';
      // Until BE exposes a shared business transaction code, correlate rows by
      // persisted source + movement type + reason. Do not present Mongo row IDs
      // as if they were TXK/PNK business codes.
      const source = tx.sourceId ? (tx.sourceType || 'SOURCE') + ':' + tx.sourceId : '';
      const fallbackKey = source
        ? [tx.transactionType, source, tx.reason || ''].join('|')
        : 'row:' + tx.id;
      const key = explicit ? 'code:' + explicit : fallbackKey;
      const current = groups.get(key) ?? { key, code: explicit, rows: [] };
      current.rows.push(tx);
      groups.set(key, current);
    }
    return [...groups.values()];
  });
  readonly productThumbs = signal<Record<string,string>>({});
  // Only render actual order audit events. The milestone bar is a separate
  // status visualization and must not create synthetic history records.
  readonly detailHistory = computed(() => {
    const order = this.selected();
    if (!order) return [];
    const history = (order.statusHistory ?? []).filter(event => !!event.at)
      .map(event => ({status: event.status, at: event.at, note: event.note ?? null}));
    if (order.createdAt && !history.some(event => event.status === 'PENDING')) {
      history.push({status: 'PENDING', at: order.createdAt, note: null});
    }
    return history.sort((a,b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0));
  });
  readonly branches = signal<{ id: string; name: string }[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly search = signal('');
  readonly status = signal<OrderFilter>('ALL');
  readonly branchId = signal('ALL');
  readonly page = signal(1);
  readonly pageSize = 6;
  readonly pageNumbers = computed(() => adminPageWindow(this.page(),this.totalPages()));
  readonly dialog = signal<ActionDialog>(null);
  readonly dialogBusy = signal(false);
  private cancelRequestKey: string | null = null;
  readonly reason = signal('');
  readonly cancelCategory = signal('');
  readonly statusNote = signal('');
  readonly carrier = signal('');
  readonly tracking = signal('');
  readonly detailInfo = computed(() => this.selected());

  readonly dateFilteredOrders = computed(() => {
    const range = Number(this.dateRange());
    if (!range) return this.allOrders();
    const cutoff = Date.now() - range * 86400000;
    return this.allOrders().filter(order => Boolean(order.createdAt) && new Date(order.createdAt!).getTime() >= cutoff);
  });
  readonly rows = computed(() => {
    const query = this.search().trim().toLocaleLowerCase('vi');
    return this.dateFilteredOrders().filter((row) => {
      const customer = this.customerName(row).toLocaleLowerCase('vi');
      return (!query || [row.code, customer, row.contactSnapshot?.phone ?? ''].some((v) => v.toLocaleLowerCase('vi').includes(query))) &&
        (this.status() === 'ALL' || row.status === this.status()) &&
        (this.branchId() === 'ALL' || row.fulfillmentBranchId === this.branchId());
    });
  });
  readonly filteredReturns = computed(() => {
    const q = this.search().trim().toLocaleLowerCase('vi');
    const status = this.status();
    const branch = this.branchId();
    const from = this.returnDateFrom();
    const to = this.returnDateTo();
    if (this.invalidReturnDates()) return [];
    return this.returns().filter(row => {
      // BE OrderReturn does not yet expose branchId/createdAt; resolve branch from parent order.
      const branchOfOrder = this.allOrders().find(order => order.id === row.orderId)?.fulfillmentBranchId
        ?? this.returnBranchLookup()[row.orderId];
      const created = row.history?.find(event => event.status === 'REQUESTED')?.at ?? row.history?.[0]?.at;
      const day = this.localReturnDay(created);
      return (!q || [row.id, row.orderId, this.returnOrderCode(row.orderId), ...row.items.map(item => item.productName)].some(v => v.toLocaleLowerCase('vi').includes(q))) &&
        (status === 'ALL' || row.status === status) &&
        (branch === 'ALL' || branchOfOrder === branch) &&
        (!from || (!!day && day >= from)) &&
        (!to || (!!day && day <= to));
    });
  });
  readonly activeRowCount = computed(() => this.activeTab() === 'orders' ? this.rows().length : this.filteredReturns().length);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.activeRowCount() / this.pageSize)));
  readonly pageRows = computed(() => this.rows().slice((this.page() - 1) * this.pageSize, this.page() * this.pageSize));
  readonly returnPageRows = computed(() => this.filteredReturns().slice((this.page() - 1) * this.pageSize, this.page() * this.pageSize));
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
    this.returnNotifications.ensureLoaded();
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((query) => {
      if (!this.isDetail() && query.get('tab') === 'returns') this.setTab('returns');
    });
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.orderId.set(params.get('id') ?? '');
      this.dialog.set(null);
      if (this.isDetail()) this.loadDetail();
      else this.loadOrders();
    });
    this.branchApi.listBranches().pipe(takeUntilDestroyed()).subscribe({
      next: (records) => {
        const user = this.session.user();
        const scope = new Set(user?.branchScope ?? []);
        const visible = user?.systemRole === 'ADMIN'
          ? records
          : records.filter((branch) => scope.has(branch.id));
        this.branches.set(visible.map((branch) => ({ id: branch.id, name: branch.name })));
      },
      error: () => { /* Branch titles are optional; Order API remains authoritative. */ },
    });
  }

  setTab(tab: 'orders' | 'returns'): void {
    if (tab === this.activeTab()) return;
    this.activeTab.set(tab);
    this.search.set('');
    this.status.set('ALL');
    this.dateRange.set('0');
    this.branchId.set('ALL');
    this.returnDateFrom.set('');
    this.returnDateTo.set('');
    this.closeReturnCalendar();
    this.page.set(1);
    if (tab === 'returns' && !this.hasLoadedReturns()) this.loadReturns();
  }
  setDateRange(value: string): void {
    if (['0', '7', '30', '90'].includes(value)) { this.dateRange.set(value); this.page.set(1); }
  }
  formatReturnPickerDay(value: string): string {
    const parts = value.split('-');
    return parts.length === 3 ? [parts[2], parts[1], parts[0]].join('/') : '—';
  }
  toggleReturnCalendar(): void {
    if (this.returnCalendarOpen()) {
      this.closeReturnCalendar();
      return;
    }
    this.returnCalendarMonth.set((this.returnDateTo() || localDate(new Date())).slice(0, 7));
    this.returnCalendarStart.set(null);
    this.returnCalendarOpen.set(true);
  }
  closeReturnCalendar(): void {
    this.returnCalendarOpen.set(false);
    this.returnCalendarStart.set(null);
  }
  clearReturnDateRange(): void {
    this.returnDateFrom.set('');
    this.returnDateTo.set('');
    this.page.set(1);
    this.closeReturnCalendar();
  }
  changeReturnCalendarMonth(amount: number): void {
    const [year, month] = this.returnCalendarMonth().split('-').map(Number);
    this.returnCalendarMonth.set(localDate(new Date(year, month - 1 + amount, 1)).slice(0, 7));
  }
  selectReturnCalendarDay(value: string): void {
    const start = this.returnCalendarStart();
    if (!start) {
      // First click: only draft a start; do not filter until the second click.
      this.returnCalendarStart.set(value);
      return;
    }
    // Second click: commit the inclusive range, even when the dates were clicked backwards.
    this.returnDateFrom.set(start <= value ? start : value);
    this.returnDateTo.set(start <= value ? value : start);
    this.page.set(1);
    this.closeReturnCalendar();
  }
  isReturnCalendarStart(value: string): boolean {
    return value === (this.returnCalendarStart() || this.returnDateFrom());
  }
  isReturnCalendarEnd(value: string): boolean {
    return !this.returnCalendarStart() && value === this.returnDateTo();
  }
  isReturnCalendarBetween(value: string): boolean {
    if (this.returnCalendarStart()) return false;
    return value > this.returnDateFrom() && value < this.returnDateTo();
  }
  @HostListener('document:click', ['$event'])
  handleCalendarOutsideClick(event: MouseEvent): void {
    if (this.returnCalendarOpen() && event.target instanceof Element &&
        !event.target.closest('.order-admin__returns-toolbar')) this.closeReturnCalendar();
  }
  @HostListener('document:keydown.escape')
  handleCalendarEscape(): void { this.closeReturnCalendar(); }
  private localReturnDay(value?: string): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    const pieces = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(d);
    const p = (kind: Intl.DateTimeFormatPartTypes): string => pieces.find(part => part.type === kind)?.value ?? '';
    return [p('year'), p('month'), p('day')].join('-');
  }
  returnOrderCode(orderId: string): string {
    // A code comes from Order.code, not Return.orderId.
    return this.allOrders().find(order => order.id === orderId)?.code
      || this.returnOrderCodes()[orderId]
      || '—';
  }
  private resolveReturnBranches(): void {
    if (this.returnBranchResolving()) return;
    const loadedIds = new Set(this.allOrders().map(order => order.id));
    const known = this.returnOrderCodes();
    const missing = [...new Set(this.returns().map(ret => ret.orderId))]
      .filter(id => !loadedIds.has(id) && !(id in known));
    if (!missing.length) return;
    this.returnBranchResolving.set(true);
    from(missing).pipe(
      mergeMap(id => this.api.get(id).pipe(
        map(order => ({id, code: order.code, branch: order.fulfillmentBranchId as string | null})),
        catchError(() => of({id, code: '', branch: null})),
      ), 4),
      toArray(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: rows => {
        this.returnOrderCodes.update(current => Object.assign({}, current,
          ...rows.map(row => ({[row.id]: row.code}))));
        this.returnBranchLookup.update(current => Object.assign({}, current,
          ...rows.map(row => ({[row.id]: row.branch}))));
        this.returnBranchResolving.set(false);
      },
      error: () => this.returnBranchResolving.set(false),
    });
  }
  readonly unresolvedReturnBranchCount = computed(() => {
    if (this.branchId() === 'ALL') return 0;
    const ids = new Set(this.allOrders().map(order => order.id));
    const lookup = this.returnBranchLookup();
    return this.returns().filter(row => !ids.has(row.orderId) && !lookup[row.orderId]).length;
  });
  private loadReturns(): void {
    const version = ++this.returnsRequestVersion;
    this.returnsLoading.set(true); this.returnsError.set('');
    this.api.listReturns().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: page => {
        if (version !== this.returnsRequestVersion) return;
        this.returns.set(page.items);
        this.returnNotifications.updateFromList(page.items);
        this.hasLoadedReturns.set(true);
        this.returnsLoading.set(false);
        this.resolveReturnBranches();
      },
      error: (error: unknown) => {
        if (version !== this.returnsRequestVersion) return;
        this.returns.set([]);
        this.returnsError.set(orderErrorMessage(error, 'Không tải được yêu cầu trả hàng.'));
        this.returnsLoading.set(false);
      },
    });
  }
  /**
   * The existing BE finalizes Return only after the associated refund reaches
   * REFUNDED. In that contract the settled refund.amount equals the stored
   * refundBreakdown.total (set on approval). Prefer a separate settled value
   * when BE exposes one for adjustments; never show a final value before COMPLETED.
   */
  finalRefundAmount(row: OrderReturnSummary): number | null {
    if (row.status !== 'COMPLETED') return null;
    const amount = row.finalRefundAmount ?? row.refundBreakdown?.total;
    return typeof amount === 'number' && Number.isFinite(amount) && amount >= 0
      ? amount : null;
  }
  returnStatusLabel(status: ReturnStatus): string {
    return ({
      REQUESTED: 'Chờ tiếp nhận', PROCESSING: 'Đang xử lý', RECEIVED: 'Đã nhận hàng',
      APPROVED: 'Đã duyệt hoàn', REJECTED: 'Đã từ chối', COMPLETED: 'Hoàn tất',
      CANCELLED: 'Đã hủy',
    })[status] ?? 'Chưa xác định';
  }
  datePart(value?: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('vi-VN',
      { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
  }
  timePart(value?: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('vi-VN',
      { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d);
  }
  exportFile(): void {
    if (this.activeTab() === 'returns') {
      const current = this.filteredReturns();
      if (!current.length) { this.toast.show('Không có yêu cầu trả hàng để xuất file.', 'info'); return; }
      const cells = [
        ['Mã yêu cầu','Mã đơn hàng','Ngày yêu cầu','Sản phẩm','Số lượng trả','Tiền dự kiến hoàn','Hoàn cuối cùng','Trạng thái'],
        ...current.map(row => [row.id, this.returnOrderCode(row.orderId), this.datePart(row.history?.[0]?.at),
          row.items.map(item => item.productName).join('; '),
          String(row.items.reduce((sum, item) => sum + item.requestedQty, 0)),
          String(row.refundBreakdown.total), this.finalRefundAmount(row) === null ? '' : String(this.finalRefundAmount(row)),
           this.returnStatusLabel(row.status)]),
      ];
      this.downloadCsv('yeu-cau-tra-hang-da-tai.csv', cells);
      return;
    }
    const current = this.rows();
    if (!current.length) { this.toast.show('Không có đơn hàng để xuất file.', 'info'); return; }
    const cells = [
      ['Mã đơn','Ngày tạo','Giờ tạo','Khách hàng','Tổng tiền','Thanh toán','Trạng thái'],
      ...current.map(row => [row.code, this.datePart(row.createdAt), this.timePart(row.createdAt),
        this.customerName(row), String(row.pricing.totalAmount), this.paymentStatus(row), this.statusLabel(row.status)]),
    ];
    const csv = '\uFEFF' + cells.map(line => line.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const objectUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = objectUrl; link.download = 'don-hang-da-tai.csv'; link.click();
    URL.revokeObjectURL(objectUrl);
    this.toast.show('Đã xuất danh sách đơn hàng đang hiển thị theo bộ lọc.', 'success');
  }
  private downloadCsv(filename: string, cells: string[][]): void {
    const csv = '\uFEFF' + cells.map(row => row.map(value => '"' + String(value).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const objectUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = objectUrl; link.download = filename; link.click();
    URL.revokeObjectURL(objectUrl);
    this.toast.show('Đã xuất danh sách yêu cầu trả hàng đang hiển thị theo bộ lọc.', 'success');
  }

  setSearch(value: string): void { this.search.set(value); this.page.set(1); }
  setStatus(value: string): void {
    if (value === 'ALL' || value in STATUS_LABELS || ['REQUESTED','RECEIVED','APPROVED','REJECTED'].includes(value)) {
      this.status.set(value as OrderFilter); this.page.set(1);
    }
  }
  setBranch(value: string): void { this.branchId.set(value); this.page.set(1); if (this.activeTab() === 'returns') this.resolveReturnBranches(); }
  changePage(next: number): void {
    if (next >= 1 && next <= this.totalPages()) this.page.set(next);
  }
  clearFilters(): void {
    this.search.set(''); this.status.set('ALL'); this.branchId.set('ALL'); this.dateRange.set('0');
    this.returnDateFrom.set(defaultReturnStart()); this.returnDateTo.set(localDate(new Date())); this.page.set(1);
  }
  refresh(): void { if (this.isDetail()) this.loadDetail(); else if (this.activeTab() === 'returns') this.loadReturns(); else this.loadOrders(); }

  private loadOrders(): void {
    const version = ++this.ordersRequestVersion;
    this.loading.set(true); this.error.set('');
    this.api.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (page) => {
        if (version !== this.ordersRequestVersion) return;
        this.allOrders.set(Array.isArray(page.items) ? page.items : []);
        this.page.set(1); this.loading.set(false);
      },
      error: (error: unknown) => {
        if (version !== this.ordersRequestVersion) return;
        this.loading.set(false); this.allOrders.set([]);
        this.error.set(orderErrorMessage(error, 'Không tải được danh sách đơn hàng.'));
      },
    });
  }
  inventoryName(id: string): string {
    const item = this.orderInventoryItems().find(entry => entry.id === id);
    return item ? item.name : 'Mặt hàng ' + id;
  }
  inventorySku(id: string): string {
    return this.orderInventoryItems().find(entry => entry.id === id)?.sku || '—';
  }
  inventoryTransactionLabel(tx: InventoryTransactionDto): string {
    if (tx.transactionType === 'ISSUE') return 'Xuất kho';
    if (tx.transactionType === 'RECEIPT' && /cancel|hủy|compensation/i.test(tx.reason || '')) {
      return 'Hoàn tồn do hủy đơn';
    }
    if (tx.transactionType === 'RECEIPT') return 'Nhập kho';
    if (tx.transactionType === 'ADJUSTMENT') return 'Điều chỉnh tồn';
    return 'Giao dịch kho';
  }
  inventoryGroupBranch(group: { rows: InventoryTransactionDto[] }): string {
    return this.branchName(group.rows[0]?.branchId || this.selected()?.fulfillmentBranchId || '');
  }
  openInventoryGroup(code: string, rows: InventoryTransactionDto[]): void {
    this.selectedInventoryCode.set(code);
    this.selectedInventoryGroup.set(rows);
    this.inventoryDrawerOpen.set(true);
  }
  closeInventoryDrawer(): void {
    this.inventoryDrawerOpen.set(false);
    this.selectedInventoryCode.set('');
    this.selectedInventoryGroup.set([]);
  }
  retryOrderInventory(): void {
    const order = this.selected();
    if (order) this.loadOrderInventory(order);
  }

  private loadOrderImages(order: OrderRecord): void {
    this.productThumbs.set({});
    const ids=[...new Set(order.items.map(item=>item.productId).filter(Boolean))];
    if(!ids.length)return;
    forkJoin(ids.map(id=>this.productApi.getProduct(id).pipe(
      map(product=>[id,product.images.find(img=>img.isPrimary)?.url
        || product.images[0]?.url || ''] as const),
      catchError(()=>of([id,''] as const)),
    ))).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(rows=>{
      if(this.orderId()!==order.id)return;
      this.productThumbs.set(Object.fromEntries(rows));
    });
  }

  private loadOrderInventory(order: OrderRecord): void {
    // Current BE creates ORDER/ISSUE during checkout, before the Order enters
    // later lifecycle states. Cancellation may add ORDER/RECEIPT compensation.
    // Do not infer inventory from status; render every persisted stock movement
    // that belongs to this Order.
    this.orderInventory.set([]);
    this.orderInventoryItems.set([]);
    this.orderInventoryError.set(false);
    this.orderInventoryLoading.set(true);
    const requestedId = order.id;
    forkJoin({
      transactions: this.inventoryApi.listTransactions(),
      items: this.inventoryApi.listItems(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({transactions,items}) => {
        if (this.orderId() !== requestedId) return;
        this.orderInventoryItems.set(items);
        this.orderInventory.set(transactions.filter(tx => {
          const sourceType = tx.sourceType?.toUpperCase() || '';
          return (tx.transactionType === 'ISSUE' || tx.transactionType === 'RECEIPT') &&
            (sourceType === 'ORDER' || sourceType === 'ORD' || sourceType.includes('ORDER')) &&
            (tx.sourceId === order.id || tx.sourceId === order.code);
        }));
        this.orderInventoryLoading.set(false);
      },
      error: () => {
        if (this.orderId() !== requestedId) return;
        this.orderInventoryError.set(true);
        this.orderInventoryLoading.set(false);
      },
    });
  }

  private loadDetail(): void {
    const id = this.orderId();
    const version = ++this.detailRequestVersion;
    if (!id) return;
    this.loading.set(true); this.error.set('');
    this.selected.set(null);
    this.orderInventory.set([]);
    this.closeInventoryDrawer();
    this.productThumbs.set({});
    this.orderInventoryLoading.set(true);
    this.orderInventoryError.set(false);
    this.api.get(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (order) => {
        if (this.orderId() !== id || version !== this.detailRequestVersion) return;
        this.selected.set(order); this.loading.set(false);
        this.loadOrderInventory(order);
        this.loadOrderImages(order);
      },
      error: (error: unknown) => {
        if (this.orderId() !== id || version !== this.detailRequestVersion) return;
        this.error.set(orderErrorMessage(error, 'Không tải được chi tiết đơn hàng.'));
        this.loading.set(false);
        this.orderInventoryLoading.set(false);
      },
    });
  }

  progressTime(order: OrderRecord, step: OrderStatus): string {
    const reached = this.milestones.indexOf(order.status) >= this.milestones.indexOf(step);
    if (!reached && order.status !== 'CANCELLED') return 'Chưa bắt đầu';
    const recordedAt = order.statusHistory?.find(entry => entry.status === step)?.at
      ?? (step === 'COMPLETED' ? order.deliveredAt : null);
    if (recordedAt) return this.when(recordedAt);
    return reached ? '—' : 'Chưa bắt đầu';
  }
  statusLabel(status: OrderStatus): string { return STATUS_LABELS[status] ?? 'Chưa xác định'; }
  historyEventLabel(status: OrderStatus): string {
    return status === 'PENDING' ? 'Đơn được tạo' : this.statusLabel(status);
  }
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
    const parts = [record['line1'], record['street'], record['address'], record['ward'], record['district'], record['city']].filter((v) => typeof v === 'string' && !!v);
    return parts.length ? parts.join(', ') : 'Chưa có địa chỉ';
  }
  actionLabel(action: OrderWriteAction): string {
    return ({
      confirm: 'Xác nhận đơn hàng',
      process: 'Chuẩn bị hàng',
      ship: 'Xác nhận bàn giao vận chuyển',
      'mark-delivered': 'Xác nhận đã giao hàng',
    })[action];
  }
  nextStatusLabel(action: OrderWriteAction): string {
    return ({
      confirm: 'Đã xác nhận',
      process: 'Chuẩn bị hàng',
      ship: 'Đang giao',
      'mark-delivered': 'Đã giao',
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
    this.reason.set(''); this.cancelCategory.set(''); this.statusNote.set(''); this.carrier.set(''); this.tracking.set('');
    this.cancelRequestKey = action === 'cancel'
      ? 'staff-cancel-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)
      : null;
    this.dialog.set(action);
  }
  isCancelReasonValid(): boolean {
    return this.cancelCategory().length > 0;
  }
  isDialogValid(action: ActionDialog): boolean {
    if (!action) return false;
    if (action === 'cancel') return this.isCancelReasonValid();
    if (action === 'ship') return this.carrier().trim().length > 0 && this.tracking().trim().length > 0;
    return true;
  }
  cancelReasonPayload(): string {
    const category = this.cancelCategory();
    const note = this.reason().trim();
    return note ? category + ' - ' + note : category;
  }
  closeDialog(): void {
    if (this.dialogBusy()) return;
    this.dialog.set(null);
    this.cancelRequestKey = null;
  }
  confirmDialog(): void {
    const action = this.dialog();
    const order = this.selected();
    if (!action || !order || this.dialogBusy() || !this.canManage()) return;
    if (action === 'cancel' && (!this.canCancel() || !this.isCancelReasonValid())) return;
    if (action !== 'cancel' && this.availableAction() !== action) return;
    if (!this.isDialogValid(action)) return;
    this.dialogBusy.set(true);
    const request = action === 'cancel'
      ? this.api.cancel(order.id, this.cancelReasonPayload(), this.cancelRequestKey ?? 'staff-cancel-' + order.id)
      : this.api.changeStatus(order.id, action, {
          carrier: this.carrier().trim(),
          trackingNumber: this.tracking().trim(),
          note: this.statusNote().trim() || undefined,
        });
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (updated) => {
        this.dialogBusy.set(false); this.dialog.set(null);
        this.cancelRequestKey = null;
        this.selected.set(updated);
        this.toast.show(action === 'cancel' ? 'Đơn hàng đã được hủy.' : 'Đã cập nhật trạng thái đơn hàng.', 'success');
        this.loadDetail();
      },
      error: (error: unknown) => {
        this.dialogBusy.set(false);
        this.toast.show(orderErrorMessage(error, 'Không thể cập nhật đơn hàng. Vui lòng thử lại.'), 'error');
        this.loadDetail();
      },
    });
  }
}

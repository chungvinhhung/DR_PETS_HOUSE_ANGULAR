import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import {
  BranchApiRecord, BranchManagementApiService,
} from '../../branch-management/services/branch-management-api.service';
import {
  AdminDashboardService, DashboardAttention, DashboardAttentionAppointment,
  DashboardAttentionOrder, DashboardFilters, DashboardKpiMetric,
  DashboardLowStock, DashboardRevenueAnalytics, DashboardRevenuePoint,
  DashboardServiceStats, DashboardSummary,
} from './admin-dashboard.service';

type Period = 'today' | '7d' | '30d' | 'custom';
type KpiKey = 'revenue' | 'orders' | 'appointments' | 'activeCustomers';
type ActionTab = 'orders' | 'appointments';
interface StatusSlice {
  key: string;
  label: string;
  count: number;
  percent: number;
  color: string;
}
interface RevenueChartPoint extends DashboardRevenuePoint {
  index: number;
  x: number;
  orderY: number;
  serviceY: number;
  totalY: number;
  label: string;
}
const TONE_COLORS: Record<string, string> = {
  amber: '#F2AE35', blue: '#347FE7', indigo: '#8264DF',
  teal: '#20A9AE', green: '#20B77B', red: '#EF6976', slate: '#8799ad',
};
const STATUS_FALLBACK: Record<string, {label: string; tone: string}> = {
  PENDING: {label:'Chờ xác nhận',tone:'amber'},
  PENDING_PAYMENT: {label:'Chờ thanh toán',tone:'amber'},
  PENDING_CONFIRMATION: {label:'Chờ xác nhận',tone:'amber'},
  CONFIRMED: {label:'Đã xác nhận',tone:'blue'},
  PROCESSING: {label:'Đang xử lý',tone:'indigo'},
  IN_PROGRESS: {label:'Đang thực hiện',tone:'indigo'},
  SHIPPED: {label:'Đang giao',tone:'teal'},
  COMPLETED: {label:'Hoàn thành',tone:'green'},
  CANCELLED: {label:'Đã hủy',tone:'red'},
  NO_SHOW: {label:'Vắng mặt',tone:'slate'},
};
const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

function vietnamDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: VN_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = (name: string): string => parts.find(p => p.type === name)?.value ?? '';
  return [part('year'), part('month'), part('day')].join('-');
}
function shiftCalendar(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}
function dateIsValid(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
}
function dateRangeDays(from: string, to: string): number {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000) + 1;
}
function validCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
function validMoney(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

@Component({
  selector: 'app-admin-dashboard-page',
  standalone: true,
  imports: [RouterLink, AdminCatalogShellComponent],
  templateUrl: './admin-dashboard-page.component.html',
  styleUrl: './admin-dashboard-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboardPageComponent {
  private readonly dashboard = inject(AdminDashboardService);
  private readonly branchApi = inject(BranchManagementApiService);
  private readonly session = inject(AuthSessionService);
  private readonly destroyRef = inject(DestroyRef);
  private requestVersion = 0;
  private branchVersion = 0;

  readonly role = computed(() => this.session.user()?.systemRole ?? '');
  readonly manager = computed(() => this.role() === 'MANAGER');
  readonly authorized = computed(() => this.role() === 'ADMIN' ||
    (this.manager() && (this.session.user()?.branchScope?.length ?? 0) > 0));

  readonly period = signal<Period>('30d');
  readonly branchId = signal('');
  readonly branches = signal<BranchApiRecord[]>([]);
  readonly branchLoading = signal(true);
  readonly branchError = signal('');
  readonly filterError = signal('');
  readonly today = vietnamDate(new Date());
  readonly from = signal(shiftCalendar(this.today, -29));
  readonly to = signal(this.today);
  readonly rangeLabel = computed(() => this.formatDate(this.from()) + ' – ' + this.formatDate(this.to()));
  readonly accessibleBranches = computed(() => {
    if (!this.manager()) return this.branches();
    const assigned = new Set((this.session.user()?.branchScope ?? []).map(String));
    return this.branches().filter(b => assigned.has(String(b.id)));
  });

  readonly loading = signal(false);
  readonly error = signal('');
  readonly summary = signal<DashboardSummary | null>(null);
  readonly revenueLoading = signal(false);
  readonly revenueError = signal('');
  readonly revenue = signal<DashboardRevenueAnalytics | null>(null);
  readonly serviceLoading = signal(false);
  readonly serviceError = signal('');
  readonly services = signal<DashboardServiceStats | null>(null);
  readonly stockLoading = signal(false);
  readonly stockError = signal('');
  readonly stock = signal<DashboardLowStock | null>(null);
  readonly attentionLoading = signal(false);
  readonly attentionError = signal('');
  readonly attention = signal<DashboardAttention | null>(null);
  readonly checkedAt = signal('');
  readonly actionTab = signal<ActionTab>('orders');
  readonly hoveredRevenueIndex = signal<number | null>(null);

  readonly metrics = computed(() => this.summary()?.kpis ?? null);
  readonly revenueIssue = computed(() => {
    const summary = this.summary();
    const revenue = this.revenue();
    if (!revenue || !summary) return '';
    if (!validMoney(revenue.totalRevenue) || !validMoney(summary.kpis?.revenue?.current)) {
      return 'Dữ liệu doanh thu không hợp lệ.';
    }
    const total = revenue.points?.reduce((sum, p) => sum + p.totalRevenue, 0);
    if (!Array.isArray(revenue.points) || !validMoney(total) ||
        Math.abs(total - revenue.totalRevenue) > 1 ||
        Math.abs(summary.kpis.revenue.current - revenue.totalRevenue) > 1) {
      return 'Doanh thu biểu đồ không khớp tổng KPI. Vui lòng báo Backend kiểm tra.';
    }
    return '';
  });
  readonly revenueReady = computed(() => !!this.revenue() && !this.revenueIssue());

  readonly orderSlices = computed(() => this.statusSlices('order'));
  readonly appointmentSlices = computed(() => this.statusSlices('appointment'));
  readonly orderDonut = computed(() => this.donutGradient(this.orderSlices()));
  readonly appointmentDonut = computed(() => this.donutGradient(this.appointmentSlices()));

  readonly orderRows = computed(() => this.attention()?.orders ?? []);
  readonly appointmentRows = computed(() => this.attention()?.appointments ?? []);

  readonly chart = computed(() => {
    if (!this.revenueReady()) return null;
    const source = this.revenue()?.points ?? [];
    if (!source.length) return null;
    const left = 56, right = 626, top = 14, bottom = 202;
    const values = source.flatMap(p => [p.orderRevenue, p.serviceRevenue, p.totalRevenue, 0]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const margin = Math.max((max - min) * .08, 1);
    const yMin = min < 0 ? min - margin : 0;
    const yMax = max > 0 ? max + margin : 1;
    const y = (v: number) => bottom - (v - yMin) / (yMax - yMin) * (bottom - top);
    const zeroY = y(0);
    const points: RevenueChartPoint[] = source.map((p, index) => ({
      ...p, index,
      x: left + (source.length === 1 ? .5 : index / (source.length - 1)) * (right - left),
      orderY: y(p.orderRevenue),
      serviceY: y(p.serviceRevenue),
      totalY: y(p.totalRevenue),
      label: this.periodLabel(p.periodStart),
    }));
    const line = (key: 'orderY' | 'serviceY' | 'totalY') =>
      points.map((p, i) => (i ? 'L ' : 'M ') + p.x.toFixed(1) + ' ' + p[key].toFixed(1)).join(' ');
    const area = line('totalY') + ' L ' + points[points.length - 1].x.toFixed(1) + ' ' +
      zeroY.toFixed(1) + ' L ' + points[0].x.toFixed(1) + ' ' + zeroY.toFixed(1) + ' Z';
    const indices = Array.from(new Set([0,1,2,3,4].map(i =>
      Math.round(i * (points.length - 1) / 4))));
    return {
      points, zeroY, lineOrders: line('orderY'), lineServices: line('serviceY'),
      lineTotal: line('totalY'), area,
      ticks: [0,1,2,3,4].map(i => ({
        y: bottom - i / 4 * (bottom - top),
        amount: yMin + i / 4 * (yMax - yMin),
      })),
      labels: indices.map(i => points[i]),
    };
  });
  readonly hoveredRevenuePoint = computed(() => {
    const index = this.hoveredRevenueIndex();
    return index === null ? null : this.chart()?.points[index] ?? null;
  });

  constructor() {
    if (this.authorized()) this.loadBranches();
    else this.branchLoading.set(false);
  }

  private statusSlices(type: 'order' | 'appointment'): StatusSlice[] {
    const summary = this.summary();
    if (!summary) return [];
    const metric = type === 'order' ? summary.kpis?.orders : summary.kpis?.appointments;
    const counts = type === 'order' ? summary.orderCountsByStatus : summary.appointmentCountsByStatus;
    const catalog = type === 'order' ? summary.statusCatalog?.order : summary.statusCatalog?.appointment;
    if (!validCount(metric?.current) || !counts) return [];
    const entries = Object.entries(counts).filter(([, count]) => validCount(count));
    if (entries.reduce((sum, [, count]) => sum + count, 0) !== metric.current || !metric.current) return [];
    return entries.filter(([, count]) => count > 0).map(([key, count]) => {
      const meta = catalog?.find(item => item.code === key) ?? STATUS_FALLBACK[key];
      return {
        key, count, label: meta?.label ?? key.replaceAll('_', ' '),
        color: TONE_COLORS[meta?.tone ?? 'slate'] ?? TONE_COLORS['slate'],
        percent: count / metric.current * 100,
      };
    }).sort((a, b) => b.count - a.count);
  }
  private donutGradient(slices: StatusSlice[]): string {
    let cursor = 0;
    const stops = slices.map(slice => {
      const start = cursor; cursor += slice.percent;
      return slice.color + ' ' + start + '% ' + cursor + '%';
    });
    return stops.length ? 'conic-gradient(' + stops.join(', ') + ')' : '';
  }

  metric(key: KpiKey): DashboardKpiMetric | null {
    return this.metrics()?.[key] ?? null;
  }
  kpiDelta(metric: DashboardKpiMetric): string {
    if (metric.changePercent !== null && validMoney(metric.changePercent)) {
      return (metric.changePercent > 0 ? '+' : '') + this.percentage(metric.changePercent) + ' so với kỳ trước';
    }
    if (metric.previous <= 0 && metric.current !== metric.previous) {
      return (metric.delta > 0 ? '+' : '') + (metric.currency ? this.money(metric.delta) : this.formatInt(metric.delta))
        + ' so với kỳ trước';
    }
    return 'Không đổi so với kỳ trước';
  }
  trendPath(metric: DashboardKpiMetric): string {
    const points = metric.trend ?? [];
    if (!points.length) return '';
    const values = points.map(p => p.value);
    const min = Math.min(...values), max = Math.max(...values);
    return points.map((p, i) =>
      (i ? 'L ' : 'M ') + (i / Math.max(1, points.length - 1) * 100).toFixed(1) + ' ' +
      (33 - (p.value - min) / (max - min || 1) * 27).toFixed(1),
    ).join(' ');
  }
  kpiTone(metric: DashboardKpiMetric): string {
    return metric.delta > 0 ? 'up' : metric.delta < 0 ? 'down' : 'flat';
  }
  formatInt(value: number): string {
    return Math.round(value).toLocaleString('vi-VN');
  }
  money(value: number | null | undefined): string {
    return validMoney(value) ? value.toLocaleString('vi-VN') + 'đ' : '—';
  }
  formatCompactMoney(value: number): string {
    const sign = value < 0 ? '−' : '';
    const abs = Math.abs(value);
    if (abs >= 1000000) return sign + (abs / 1000000).toLocaleString('vi-VN',{maximumFractionDigits:1}) + 'tr';
    if (abs >= 1000) return sign + (abs / 1000).toLocaleString('vi-VN',{maximumFractionDigits:0}) + 'k';
    return sign + this.formatInt(abs);
  }
  percentage(value: number): string {
    return new Intl.NumberFormat('vi-VN', {maximumFractionDigits: 1}).format(value) + '%';
  }
  formatDate(value: string): string {
    const [year, month, day] = value.split('-');
    return [day, month, year].join('/');
  }
  periodLabel(value: string): string {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const date = new Date(value);
      if (Number.isFinite(date.getTime())) {
        return new Intl.DateTimeFormat('vi-VN', {
          timeZone: VN_TIMEZONE, hour: '2-digit', minute: '2-digit',
        }).format(date);
      }
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-');
      return this.revenue()?.granularity === 'month' ? month + '/' + year : day + '/' + month;
    }
    return value;
  }
  shortTime(value: string | null | undefined): string {
    if (!value || !Number.isFinite(Date.parse(value))) return '—';
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: VN_TIMEZONE, day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(value));
  }
  onStockImageError(event: Event): void {
    const image = event.target;
    if (image instanceof HTMLImageElement) {
      image.onerror = null;
      image.style.display = 'none';
    }
  }

  setActionTab(value: ActionTab): void { this.actionTab.set(value); }
  changePeriod(value: string): void {
    if (value !== 'today' && value !== '7d' && value !== '30d' && value !== 'custom') return;
    this.period.set(value);
    if (value === 'custom') return;
    const today = vietnamDate(new Date());
    this.to.set(today);
    this.from.set(shiftCalendar(today, value === 'today' ? 0 : value === '7d' ? -6 : -29));
    this.filterError.set('');
    this.refresh();
  }
  changeFrom(value: string): void { this.from.set(value); this.filterError.set(''); }
  changeTo(value: string): void { this.to.set(value); this.filterError.set(''); }
  applyCustom(): void {
    if (!dateIsValid(this.from()) || !dateIsValid(this.to()) || this.from() > this.to()) {
      this.filterError.set('Ngày bắt đầu và kết thúc phải hợp lệ, theo đúng thứ tự.');
      return;
    }
    if (dateRangeDays(this.from(), this.to()) > 366) {
      this.filterError.set('Khoảng thống kê không được vượt quá 366 ngày.');
      return;
    }
    this.filterError.set('');
    this.refresh();
  }
  changeBranch(value: string): void {
    if (value && !this.accessibleBranches().some(b => String(b.id) === value)) return;
    this.branchId.set(value);
    this.refresh();
  }

  loadBranches(): void {
    if (!this.authorized()) return;
    const request = ++this.branchVersion;
    this.branchLoading.set(true);
    this.branchError.set('');
    this.branchApi.listBranches().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: branches => {
        if (request !== this.branchVersion) return;
        this.branches.set(branches);
        this.branchLoading.set(false);
        const visible = this.accessibleBranches();
        if (this.manager() && !visible.length) {
          this.branchError.set('Không tìm thấy chi nhánh được phân công. Vui lòng liên hệ quản trị viên.');
          return;
        }
        if (this.manager() && visible.length === 1) this.branchId.set(visible[0].id);
        if (this.branchId() && !visible.some(b => b.id === this.branchId())) this.branchId.set('');
        this.refresh();
      },
      error: () => {
        if (request !== this.branchVersion) return;
        this.branchLoading.set(false);
        this.branchError.set('Không thể tải danh sách chi nhánh. Vui lòng thử lại.');
      },
    });
  }
  refresh(): void {
    if (!this.authorized() || this.branchLoading() || this.branchError() || this.filterError()) return;
    if (!dateIsValid(this.from()) || !dateIsValid(this.to()) ||
        this.from() > this.to() || dateRangeDays(this.from(), this.to()) > 366) {
      this.filterError.set('Khoảng thời gian không hợp lệ (tối đa 366 ngày).');
      return;
    }
    const request = ++this.requestVersion;
    const filters: DashboardFilters = {from: this.from(), to: this.to(), branchId: this.branchId() || null};
    this.loading.set(true); this.error.set(''); this.summary.set(null);
    this.revenueLoading.set(true); this.revenueError.set(''); this.revenue.set(null);
    this.serviceLoading.set(true); this.serviceError.set(''); this.services.set(null);
    this.stockLoading.set(true); this.stockError.set(''); this.stock.set(null);
    this.attentionLoading.set(true); this.attentionError.set(''); this.attention.set(null);
    this.hoveredRevenueIndex.set(null);
    this.checkedAt.set('');

    // One request per widget. A failure never causes fake data or clears other widgets.
    this.dashboard.summary(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        if (request !== this.requestVersion) return;
        if (!data?.kpis?.orders || !data?.kpis?.revenue) {
          this.error.set('API Dashboard chưa trả đủ dữ liệu kpis theo contract M23.');
        } else {
          this.summary.set(data);
        }
        this.loading.set(false);
        this.checkedAt.set(new Intl.DateTimeFormat('vi-VN', {
          hour: '2-digit', minute: '2-digit', timeZone: VN_TIMEZONE,
        }).format(new Date()));
      },
      error: err => {
        if (request !== this.requestVersion) return;
        this.error.set(this.apiError(err, 'Không thể tải số liệu Dashboard.'));
        this.loading.set(false);
      },
    });
    this.dashboard.revenue(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        if (request !== this.requestVersion) return;
        if (!data || !Array.isArray(data.points)) this.revenueError.set('API chưa trả chuỗi doanh thu đúng định dạng.');
        else this.revenue.set(data);
        this.revenueLoading.set(false);
      },
      error: err => {
        if (request !== this.requestVersion) return;
        this.revenueError.set(this.apiError(err, 'Không thể tải biểu đồ doanh thu.'));
        this.revenueLoading.set(false);
      },
    });
    this.dashboard.serviceStats(filters, 5).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        if (request !== this.requestVersion) return;
        if (!data || !Array.isArray(data.items)) this.serviceError.set('API Top dịch vụ trả dữ liệu không hợp lệ.');
        else this.services.set(data);
        this.serviceLoading.set(false);
      },
      error: err => {
        if (request !== this.requestVersion) return;
        this.serviceError.set(this.apiError(err, 'Không thể tải Top dịch vụ.'));
        this.serviceLoading.set(false);
      },
    });
    this.dashboard.lowStock(filters.branchId, 5).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        if (request !== this.requestVersion) return;
        if (!data || !Array.isArray(data.items)) this.stockError.set('API tồn kho trả dữ liệu không hợp lệ.');
        else this.stock.set(data);
        this.stockLoading.set(false);
      },
      error: err => {
        if (request !== this.requestVersion) return;
        this.stockError.set(this.apiError(err, 'Không thể tải cảnh báo tồn kho.'));
        this.stockLoading.set(false);
      },
    });
    this.dashboard.attention(filters.branchId, 5).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        if (request !== this.requestVersion) return;
        if (!data || !Array.isArray(data.orders) || !Array.isArray(data.appointments)) {
          this.attentionError.set('API Cần xử lý ngay trả dữ liệu không hợp lệ.');
        } else this.attention.set(data);
        this.attentionLoading.set(false);
      },
      error: err => {
        if (request !== this.requestVersion) return;
        this.attentionError.set(this.apiError(err, 'Không thể tải danh sách cần xử lý.'));
        this.attentionLoading.set(false);
      },
    });
  }
  private apiError(error: unknown, fallback: string): string {
    const err = error as {status?: number; code?: string; details?: unknown} | null;
    const details = err?.details as { code?: string } | null;
    const code = details?.code ?? err?.code ?? '';
    if (code === 'BRANCH_SCOPE_EMPTY') return 'Tài khoản chưa được phân quyền chi nhánh.';
    if (code === 'BRANCH_ACCESS_DENIED' || code === 'BRANCH_SCOPE_ERROR') {
      this.branchId.set('');
      return 'Chi nhánh không thuộc phạm vi được phân quyền. Đã bỏ chọn chi nhánh.';
    }
    if (code === 'BRANCH_NOT_FOUND') {
      this.branchId.set('');
      return 'Chi nhánh không còn tồn tại. Hãy tải lại danh sách chi nhánh.';
    }
    if (err?.status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
    if (err?.status === 403) return 'Tài khoản không có quyền truy cập dữ liệu này.';
    if (err?.status === 400) return 'Bộ lọc chưa hợp lệ. Vui lòng kiểm tra ngày và chi nhánh.';
    return fallback;
  }
}

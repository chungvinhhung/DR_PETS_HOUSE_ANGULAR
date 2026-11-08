import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpParams } from '@angular/common/http';

import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { BranchApiRecord, BranchManagementApiService } from '../../branch-management/services/branch-management-api.service';
import { AdminDashboardService, DashboardFilters, DashboardSummary } from './admin-dashboard.service';
import { AdminOrderApiService, OrderRecord } from '../../orders/services/admin-order-api.service';
import { ApiClientService } from '../../../../core/services/api-client.service';
import { AppointmentView, normalizeAppointmentPage } from '../appointments/admin-appointment-workflow.model';
import { DEMO_BRANCHES, DemoActionRow, DemoDashboardData, createDemoDashboard } from './admin-dashboard-demo.data';

type Period = 'today' | '7d' | '30d' | 'custom';
type Tone = 'amber' | 'blue' | 'indigo' | 'teal' | 'green' | 'red' | 'slate';
interface StatusSlice {
  key: string;
  label: string;
  count: number;
  percent: number;
  tone: Tone;
  color: string;
}
interface OrderComparison {
  previous: number;
  current: number;
  previousBar: number;
  currentBar: number;
  direction: 'up' | 'down' | 'flat';
  label: string;
}
const STATUS: Record<string, { label: string; tone: Tone; color: string }> = {
  PENDING: { label: 'Chờ xác nhận', tone: 'amber', color: '#F2AE35' },
  CONFIRMED: { label: 'Đã xác nhận', tone: 'blue', color: '#347FE7' },
  PROCESSING: { label: 'Đang xử lý', tone: 'indigo', color: '#8264DF' },
  SHIPPED: { label: 'Đang giao', tone: 'teal', color: '#20A9AE' },
  DELIVERED: { label: 'Đã giao', tone: 'green', color: '#20B77B' },
  COMPLETED: { label: 'Hoàn thành', tone: 'green', color: '#20B77B' },
  CANCELLED: { label: 'Đã hủy', tone: 'red', color: '#EF6976' },
};
const FALLBACK = { tone: 'slate' as const, color: '#8799ad' };

function vietnamDate(date: Date): string {
  const fields = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = (name: string): string => fields.find(field => field.type === name)?.value ?? '';
  return [part('year'), part('month'), part('day')].join('-');
}
function shiftCalendar(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
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
  private readonly route = inject(ActivatedRoute);
  /** Reversible sample preview; never enabled without an explicit query parameter. */
  readonly demo = this.route.snapshot.queryParamMap.get('demo') === '1';
  private readonly ordersApi = inject(AdminOrderApiService);
  private readonly client = inject(ApiClientService);
  private actionsVersion = 0;
  private readonly branchApi = inject(BranchManagementApiService);
  private readonly session = inject(AuthSessionService);
  private readonly destroyRef = inject(DestroyRef);
  private version = 0;

  readonly role = computed(() => this.session.user()?.systemRole ?? '');
  readonly manager = computed(() => this.role() === 'MANAGER');
  readonly period = signal<Period>('30d');
  readonly branchId = signal('');
  readonly branches = signal<BranchApiRecord[]>([]);
  readonly branchLoading = signal(true);
  readonly branchError = signal('');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly summary = signal<DashboardSummary | null>(null);
  readonly previousOrderCount = signal<number | null>(null);
  readonly demoData = signal<DemoDashboardData | null>(null);
  readonly hoveredRevenueIndex = signal<number | null>(null);
  readonly actionTab = signal<'orders' | 'appointments'>('orders');
  readonly actionLoading = signal(false);
  readonly actionError = signal('');
  readonly actionOrders = signal<OrderRecord[]>([]);
  readonly actionAppointments = signal<AppointmentView[]>([]);
  readonly actionCount = computed(() => this.actionTab() === 'orders'
    ? this.actionOrderRows().length : this.actionAppointmentRows().length);
  readonly actionOrderRows = computed<DemoActionRow[]>(() =>
    this.demoData()?.orders ?? this.actionOrders().map(item => ({
      id: item.id, code: item.code,
      customerName: item.contactSnapshot?.fullName || item.contactSnapshot?.name || '—',
      amount: item.pricing.totalAmount, time: item.createdAt || '',
    })));
  readonly actionAppointmentRows = computed<DemoActionRow[]>(() =>
    this.demoData()?.appointments ?? this.actionAppointments().map(item => ({
      id: item.id, code: item.code, customerName: item.customerName || '—',
      amount: item.totalAmount ?? 0, time: item.appointmentAt || '',
    })));
  readonly checkedAt = signal('');
  readonly today = vietnamDate(new Date());
  readonly from = signal(shiftCalendar(this.today, -29));
  readonly to = signal(this.today);
  readonly filterError = signal('');
  readonly accessibleBranches = computed(() => {
    if (!this.manager()) return this.branches();
    const assigned = new Set((this.session.user()?.branchScope ?? []).map(String));
    return this.branches().filter(branch => assigned.has(String(branch.id)));
  });
  readonly authorized = computed(() => this.role() === 'ADMIN' ||
    (this.manager() && (this.session.user()?.branchScope?.length ?? 0) > 0));
  readonly rangeLabel = computed(() => this.formatDate(this.from()) + ' – ' + this.formatDate(this.to()));
  readonly ordersReady = computed(() => {
    const value = this.summary()?.orders;
    return Number.isSafeInteger(value) && Number(value) >= 0;
  });
  // Only Order counts currently satisfy M23. Do not compare legacy revenue,
  // appointment or customer fields until BE supplies corrected aggregates.
  readonly orderComparison = computed<OrderComparison | null>(() => {
    const current = this.summary()?.orders;
    const previous = this.previousOrderCount();
    if (typeof current !== 'number' || !Number.isSafeInteger(current) || current < 0 ||
        previous === null || !Number.isSafeInteger(previous) || previous < 0) return null;
    const diff = current - previous;
    const direction: OrderComparison['direction'] = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
    const label = previous === 0 && current > 0
      ? '+' + this.formatInt(current) + ' đơn so với kỳ trước'
      : (diff > 0 ? '+' : '') + this.percentage(previous === 0 ? 0 : diff / previous * 100) + ' so với kỳ trước';
    const max = Math.max(current, previous, 1);
    return {
      current, previous, direction, label,
      previousBar: previous / max * 100,
      currentBar: current / max * 100,
    };
  });
  readonly orderSlices = computed<StatusSlice[]>(() => {
    const data = this.summary();
    const breakdown = data?.breakdown?.orderCountsByStatus;
    const total = data?.orders;
    if (!this.ordersReady() || !breakdown || !Number.isSafeInteger(total)) return [];
    const all = Object.entries(breakdown).filter(([name, count]) =>
      !!name && Number.isSafeInteger(count) && count >= 0);
    const sum = all.reduce((value, item) => value + item[1], 0);
    if (sum !== total || !total) return [];
    return all.filter(([, count]) => count > 0).map(([key, count]) => {
      const meta = STATUS[key] ?? { label: key.replaceAll('_', ' '), ...FALLBACK };
      return { key, label: meta.label, count, percent: count / total * 100,
        color: meta.color, tone: meta.tone };
    }).sort((a, b) => b.count - a.count);
  });
  readonly appointmentSlices = computed<StatusSlice[]>(() => {
    const demo = this.demoData();
    if (!demo) return [];
    const statuses: Record<string, { label: string; color: string; tone: Tone }> = {
      COMPLETED: { label: 'Hoàn tất', color: '#20B77B', tone: 'green' },
      CONFIRMED: { label: 'Đã xác nhận', color: '#347FE7', tone: 'blue' },
      PENDING_PAYMENT: { label: 'Chờ thanh toán', color: '#F2AE35', tone: 'amber' },
      CANCELLED: { label: 'Đã hủy', color: '#EF6976', tone: 'red' },
    };
    const total = demo.summary.appointments;
    return Object.entries(demo.appointmentStatuses).filter(([, value]) => value > 0)
      .map(([key, count]) => ({
        key, label: statuses[key]?.label ?? key, count,
        percent: total ? count / total * 100 : 0,
        color: statuses[key]?.color ?? FALLBACK.color,
        tone: statuses[key]?.tone ?? FALLBACK.tone,
      })).sort((a, b) => b.count - a.count);
  });
  readonly appointmentDonut = computed(() => {
    let current = 0;
    const stops = this.appointmentSlices().map(item => {
      const start = current; current += item.percent;
      return item.color + ' ' + start + '% ' + current + '%';
    });
    return stops.length ? 'conic-gradient(' + stops.join(',') + ')' : '';
  });

  readonly demoChart = computed(() => {
    const source = this.demoData()?.revenuePoints ?? [];
    if (!source.length) return null;
    const left = 44, right = 626, top = 12, bottom = 202;
    const maxRaw = Math.max(1, ...source.map(p => Math.max(p.order, p.service)));
    const step = Math.pow(10, Math.floor(Math.log10(maxRaw)));
    const ceiling = Math.ceil(maxRaw / step / 4) * step * 4;
    const points = source.map((p, index) => ({
      ...p, index,
      x: left + (source.length === 1 ? .5 : index / (source.length - 1)) * (right - left),
      orderY: bottom - p.order / ceiling * (bottom - top),
      serviceY: bottom - p.service / ceiling * (bottom - top),
      label: this.formatDate(p.date),
    }));
    const line = (key: 'orderY' | 'serviceY') =>
      points.map((p, i) => (i ? 'L ' : 'M ') + p.x.toFixed(1) + ' ' + p[key].toFixed(1)).join(' ');
    const area = (key: 'orderY' | 'serviceY') =>
      line(key) + ' L ' + points.at(-1)!.x.toFixed(1) + ' ' + bottom +
      ' L ' + points[0].x.toFixed(1) + ' ' + bottom + ' Z';
    const tickIndices = Array.from(new Set([0,1,2,3,4].map(i =>
      Math.round(i * (points.length - 1) / 4))));
    return { points, lineOrders: line('orderY'), lineServices: line('serviceY'),
      areaOrders: area('orderY'), areaServices: area('serviceY'), ceiling,
      ticks: [0,1,2,3,4].map(i => ({
        y: bottom - i / 4 * (bottom - top), amount: ceiling * i / 4,
      })), labels: tickIndices.map(i => points[i]),
    };
  });
  readonly hoveredRevenuePoint = computed(() => {
    const chart = this.demoChart();
    const index = this.hoveredRevenueIndex();
    return chart && index !== null ? chart.points[index] ?? null : null;
  });
  readonly demoSpark = computed(() => {
    const points = this.demoData()?.revenuePoints ?? [];
    const make = (kind: 'revenue' | 'orders' | 'appointments' | 'customers') => {
      if (!points.length) return '';
      const vals = points.map((p, i) => kind === 'revenue' ? p.order + p.service
        : kind === 'orders' ? p.order
        : kind === 'appointments' ? p.service * (0.83 + .19 * Math.sin(i * .58))
        : p.order * (0.76 + .17 * Math.cos(i * .44)));
      const min = Math.min(...vals), max = Math.max(...vals);
      return vals.map((v, i) => (i ? 'L' : 'M') + (i / Math.max(1, vals.length - 1) * 100).toFixed(1)
        + ' ' + (33 - (v - min) / (max - min || 1) * 27).toFixed(1)).join(' ');
    };
    return {revenue:make('revenue'),orders:make('orders'),
      appointments:make('appointments'),customers:make('customers')};
  });
  demoDelta(current: number, previous: number): {label: string; direction: 'up'|'down'|'flat'} {
    if (!previous) return {label: current ? '+' + this.formatInt(current) + ' so với kỳ trước' : 'Không đổi',direction:current?'up':'flat'};
    const diff = current - previous;
    return {label:(diff > 0 ? '+' : '') + this.percentage(diff / previous * 100) + ' so với kỳ trước',
      direction:diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'};
  }

  readonly orderDonut = computed(() => {
    const slices = this.orderSlices();
    if (!slices.length) return '';
    let position = 0;
    const stops = slices.map(slice => {
      const start = position;
      position += slice.percent;
      return slice.color + ' ' + start + '% ' + position + '%';
    });
    return 'conic-gradient(' + stops.join(',') + ')';
  });

  constructor() {
    if (this.authorized()) this.loadBranches();
    else this.branchLoading.set(false);
  }

  formatInt(value: number): string {
    return Math.round(value).toLocaleString('vi-VN');
  }
  formatDate(value: string): string {
    const [year, month, day] = value.split('-');
    return [day, month, year].join('/');
  }
  percentage(value: number): string {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value) + '%';
  }
  formatCompactMoney(value: number): string {
    if (value >= 1000000) return (value / 1000000).toLocaleString('vi-VN', {maximumFractionDigits: 0}) + 'tr';
    if (value >= 1000) return (value / 1000).toLocaleString('vi-VN', {maximumFractionDigits: 0}) + 'k';
    return this.formatInt(value);
  }

  private allowedBranch(branchId: string | null | undefined): boolean {
    if (this.branchId()) return String(branchId ?? '') === this.branchId();
    if (!this.manager()) return true;
    return (this.session.user()?.branchScope ?? []).map(String).includes(String(branchId ?? ''));
  }

  setActionTab(value: 'orders' | 'appointments'): void {
    if (this.actionTab() === value) return;
    this.actionTab.set(value);
    this.loadActions();
  }
  money(value: number | undefined | null): string {
    return typeof value === 'number' && Number.isFinite(value)
      ? value.toLocaleString('vi-VN') + 'đ' : '—';
  }
  shortTime(value: string | null | undefined): string {
    if (!value || !Number.isFinite(Date.parse(value))) return '—';
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(value));
  }
  loadActions(): void {
    if (!this.authorized() || this.branchLoading() || this.branchError()) return;
    if (this.demo) {
      ++this.actionsVersion;
      this.actionLoading.set(false);
      this.actionError.set('');
      return;
    }
    const version = ++this.actionsVersion;
    this.actionLoading.set(true);
    this.actionError.set('');
    this.actionOrders.set([]);
    this.actionAppointments.set([]);
    if (this.actionTab() === 'orders') {
      this.ordersApi.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: page => {
          if (this.actionsVersion !== version) return;
          this.actionOrders.set(page.items
            .filter(item => this.allowedBranch(item.fulfillmentBranchId) &&
              (item.status === 'PENDING' || item.status === 'CONFIRMED' || item.status === 'PROCESSING'))
            .sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0,3));
          this.actionLoading.set(false);
        },
        error: () => {
          if (this.actionsVersion !== version) return;
          this.actionError.set('Không thể tải đơn hàng cần xử lý.');
          this.actionLoading.set(false);
        },
      });
    } else {
      this.client.get<unknown>('/appointments', {
        params: new HttpParams().set('limit', '100'),
      }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: response => {
          if (this.actionsVersion !== version) return;
          try {
            const page = normalizeAppointmentPage(response);
            const now = Date.now();
            this.actionAppointments.set(page.items.filter(item =>
              this.allowedBranch(item.branchId) &&
              item.status !== 'CANCELLED' && item.status !== 'COMPLETED' && item.status !== 'NO_SHOW' &&
              !!item.appointmentAt && Date.parse(item.appointmentAt) >= now
            ).sort((a,b) => (a.appointmentAt || '').localeCompare(b.appointmentAt || '')).slice(0,3));
          } catch {
            this.actionError.set('Dữ liệu lịch hẹn chưa đúng định dạng.');
          }
          this.actionLoading.set(false);
        },
        error: () => {
          if (this.actionsVersion !== version) return;
          this.actionError.set('Không thể tải lịch hẹn sắp tới.');
          this.actionLoading.set(false);
        },
      });
    }
  }

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
    if (!this.from() || !this.to() || this.from() > this.to()) {
      this.filterError.set('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
      return;
    }
    this.filterError.set('');
    this.refresh();
  }
  changeBranch(id: string): void {
    if (id && !this.accessibleBranches().some(branch => String(branch.id) === id)) return;
    this.branchId.set(id);
    this.refresh();
  }

  loadBranches(): void {
    if (!this.authorized()) return;
    if (this.demo) {
      const scoped = this.manager()
        ? (this.session.user()?.branchScope ?? []).map((id, i) => ({
            id: String(id), code: 'CN' + (i + 1), name: 'Chi nhánh được giao ' + (i + 1),
            address: 'Chi nhánh minh hoạ', status: 'ACTIVE' as const,
          }))
        : DEMO_BRANCHES;
      this.branches.set(scoped);
      this.branchLoading.set(false);
      this.branchError.set('');
      if (this.manager() && scoped.length === 1) this.branchId.set(scoped[0].id);
      this.refresh();
      return;
    }
    this.branchLoading.set(true);
    this.branchError.set('');
    this.branchApi.listBranches().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: branches => {
        this.branches.set(branches);
        this.branchLoading.set(false);
        const visible = this.accessibleBranches();
        if (this.manager() && !visible.length) {
          this.branchError.set('Không tìm thấy chi nhánh được phân công. Vui lòng liên hệ quản trị viên.');
          return;
        }
        if (this.manager() && visible.length === 1) this.branchId.set(visible[0].id);
        if (this.branchId() && !visible.some(branch => branch.id === this.branchId())) this.branchId.set('');
        this.refresh();
      },
      error: () => {
        this.branchLoading.set(false);
        this.branchError.set('Không thể tải chi nhánh. Vui lòng thử lại.');
      },
    });
  }
  refresh(): void {
    if (!this.authorized() || this.branchLoading() || this.branchError() || this.filterError()) return;
    const request = ++this.version;
    this.loading.set(true);
    this.error.set('');
    this.summary.set(null); // never display a previous branch/date as the new result
    this.previousOrderCount.set(null);
    this.hoveredRevenueIndex.set(null);
    const filters: DashboardFilters = { from: this.from(), to: this.to(), branchId: this.branchId() || null };
    if (this.demo) {
      const data = createDemoDashboard(filters.from, filters.to, filters.branchId ?? '');
      this.demoData.set(data);
      this.summary.set(data.summary);
      this.previousOrderCount.set(data.previous.orders);
      this.checkedAt.set('Dữ liệu minh hoạ');
      this.loading.set(false);
      this.error.set('');
      this.loadActions();
      return;
    }
    this.demoData.set(null);
    this.loadActions();
    this.dashboard.summary(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        if (request !== this.version) return;
        if (!data || typeof data !== 'object') {
          this.error.set('API thống kê trả dữ liệu không hợp lệ.');
        } else {
          this.summary.set(data);
          this.checkedAt.set(new Intl.DateTimeFormat('vi-VN', {
            hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh',
          }).format(new Date()));
          // Compare the same number of calendar days, with the same branch scope.
          // The previous request is independent: failure must not hide current KPIs.
          if (Number.isSafeInteger(data.orders) && data.orders >= 0) {
            const days = Math.round((
              Date.parse(filters.to + 'T00:00:00Z') -
              Date.parse(filters.from + 'T00:00:00Z')
            ) / 86400000) + 1;
            if (Number.isSafeInteger(days) && days > 0) {
              const previousTo = shiftCalendar(filters.from, -1);
              const previousFrom = shiftCalendar(previousTo, 1 - days);
              this.dashboard.summary({ ...filters, from: previousFrom, to: previousTo })
                .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
                  next: previous => {
                    if (request !== this.version) return;
                    if (Number.isSafeInteger(previous?.orders) && previous.orders >= 0) {
                      this.previousOrderCount.set(previous.orders);
                    }
                  },
                  error: () => { /* Comparison unavailable; never fabricate a percentage. */ },
                });
            }
          }
        }
        this.loading.set(false);
      },
      error: () => {
        if (request !== this.version) return;
        this.summary.set(null);
        this.error.set('Không thể tải thống kê từ hệ thống.');
        this.loading.set(false);
      },
    });
  }
}

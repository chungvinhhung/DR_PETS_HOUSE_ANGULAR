import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { HttpParams } from '@angular/common/http';

import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { BranchApiRecord, BranchManagementApiService } from '../../branch-management/services/branch-management-api.service';
import { AdminDashboardService, DashboardFilters, DashboardSummary } from './admin-dashboard.service';
import { AdminOrderApiService, OrderRecord } from '../../orders/services/admin-order-api.service';
import { ApiClientService } from '../../../../core/services/api-client.service';
import { AppointmentView, normalizeAppointmentPage } from '../appointments/admin-appointment-workflow.model';

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
const STATUS: Record<string, { label: string; tone: Tone; color: string }> = {
  PENDING: { label: 'Chờ xác nhận', tone: 'amber', color: '#e5ad47' },
  CONFIRMED: { label: 'Đã xác nhận', tone: 'blue', color: '#4f8edc' },
  PROCESSING: { label: 'Đang xử lý', tone: 'indigo', color: '#8c7bd5' },
  SHIPPED: { label: 'Đang giao', tone: 'teal', color: '#42a6a4' },
  DELIVERED: { label: 'Đã giao', tone: 'green', color: '#40a775' },
  COMPLETED: { label: 'Hoàn thành', tone: 'green', color: '#40a775' },
  CANCELLED: { label: 'Đã hủy', tone: 'red', color: '#dd8585' },
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
  readonly actionTab = signal<'orders' | 'appointments'>('orders');
  readonly actionLoading = signal(false);
  readonly actionError = signal('');
  readonly actionOrders = signal<OrderRecord[]>([]);
  readonly actionAppointments = signal<AppointmentView[]>([]);
  readonly actionCount = computed(() => this.actionTab() === 'orders'
    ? this.actionOrders().length : this.actionAppointments().length);
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
    const filters: DashboardFilters = { from: this.from(), to: this.to(), branchId: this.branchId() || null };
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

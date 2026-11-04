import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminBreadcrumbComponent } from '../../../../shared/admin-breadcrumb/admin-breadcrumb.component';
import { AdminStaffWeekNavComponent } from '../components/admin-staff-week-nav.component';
import { formatStaffWeekRange } from '../utils/staff-week-range';
import { AdminToastService, adminErrorMessage } from '../../../../shared/services/admin-toast.service';
import { AdminUsersService } from '../../users/services/admin-users.service';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AdminStaffApiService, staffTodayISO, staffWeekMonday } from '../services/admin-staff-api.service';
import {
  JOB_LABELS,
  StaffPreview,
  StaffShiftPreview,
  displayStaffName,
  displayStaffShift,
} from '../models/staff-preview.model';

interface WeekDayRow {
  isoDate: string;
  label: string;
  weekday: string;
  dayMonth: string;
  shifts: readonly StaffShiftPreview[];
}

const DAY_IN_MS = 86_400_000;

function dateFromISO(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
function shortDate(date: Date): string {
  return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
function dayLabel(day: number): string {
  return day === 6 ? 'CN' : `Thứ ${day + 2}`;
}

@Component({
  selector: 'app-admin-staff-detail',
  standalone: true,
  imports: [RouterLink, AdminCatalogShellComponent, AdminBreadcrumbComponent, AdminStaffWeekNavComponent],
  templateUrl: './admin-staff-detail.component.html',
  styleUrl: './admin-staff-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminStaffDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(AdminToastService);
  private readonly session = inject(AuthSessionService);
  private readonly usersApi = inject(AdminUsersService);
  blockDialogOpen = false;
  blockBusy = false;

  readonly staffApi = inject(AdminStaffApiService);
  readonly staffId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly staff = computed(() => this.staffApi.staff().find(item => item.id === this.staffId));
  readonly weekMonday = signal(staffWeekMonday(staffTodayISO()));
  constructor() {
    this.staffApi.loadRoster();
    effect(() => {
      if (this.staffApi.loaded()) this.staffApi.loadWeek(this.weekMonday());
    });
  }
  readonly weeks = computed<readonly WeekDayRow[]>(() => {
    const startMs = dateFromISO(this.weekMonday()).getTime();
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startMs + i * DAY_IN_MS);
      const key = isoDate(date);
      return {
        isoDate: key,
        label: `${dayLabel(i)} · ${shortDate(date)}`,
        weekday: dayLabel(i),
        dayMonth: shortDate(date),
        shifts: this.staffApi.shifts().filter(s => s.staffId === this.staffId && s.isoDate === key),
      };
    });
  });
  readonly weekLabel = computed(() => formatStaffWeekRange(this.weekMonday()));

  displayName(item: StaffPreview): string { return displayStaffName(item); }
  roleName(item: StaffPreview): string { return JOB_LABELS[item.jobRole]; }
  displayShift(value: string): string { return displayStaffShift(value); }

  moveWeek(weeks: number): void {
    const next = new Date(dateFromISO(this.weekMonday()).getTime() + weeks * 7 * DAY_IN_MS);
    this.weekMonday.set(isoDate(next));
  }
  goToday(): void {
    const today = new Date();
    today.setDate(today.getDate() - (today.getDay() + 6) % 7);
    this.weekMonday.set([
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-'));
  }
  selectWeekDate(value: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    const selected = dateFromISO(value);
    if (Number.isNaN(selected.getTime()) || isoDate(selected) !== value) return;
    const daysFromMonday = (selected.getUTCDay() + 6) % 7;
    const monday = new Date(selected.getTime() - daysFromMonday * DAY_IN_MS);
    this.weekMonday.set(isoDate(monday));
  }

  get canBlockAccount(): boolean {
    return this.session.hasAnyRole(['ADMIN']) && !!this.staff()?.userId;
  }
  openBlockConfirmation(): void {
    if (!this.canBlockAccount) {
      this.toast.show('Tài khoản không có quyền chặn hoặc bỏ chặn nhân viên.', 'error');
      return;
    }
    this.blockDialogOpen = true;
  }
  closeBlockConfirmation(): void {
    this.blockDialogOpen = false;
  }
  confirmBlockPreview(): void {
    const staff = this.staff();
    if (!this.canBlockAccount || !staff?.userId || this.blockBusy) return;
    const next = staff.accountStatus === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED';
    this.blockBusy = true;
    this.usersApi.updateStatus(staff.userId, { accountStatus: next }).subscribe({
      next: () => {
        this.blockBusy = false;
        this.blockDialogOpen = false;
        this.staffApi.loadRoster(true);
        this.toast.show(next === 'BLOCKED' ? 'Đã chặn tài khoản nhân viên.' : 'Đã bỏ chặn tài khoản nhân viên.', 'success');
      },
      error: err => {
        this.blockBusy = false;
        this.toast.show(adminErrorMessage(err, 'Không thể cập nhật trạng thái tài khoản.'), 'error');
      },
    });
  }
  goBack(): void {
    void this.router.navigateByUrl('/admin/staff');
  }
}

import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { JOB_LABELS, JobRole, STAFF_PREVIEW, STAFF_SHIFTS_PREVIEW, displayStaffName } from '../models/staff-preview.model';

const DAY = 86_400_000;
const mondayOf = (iso: string): string => {
  const day = new Date(iso + 'T00:00:00Z');
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return day.toISOString().slice(0, 10);
};
const todayIso = (): string => new Date().toISOString().slice(0, 10);
const dateFor = (monday: string, offset: number): string =>
  new Date(new Date(monday + 'T00:00:00Z').getTime() + offset * DAY).toISOString().slice(0, 10);
const readable = (iso: string): string => iso.slice(8, 10) + '/' + iso.slice(5, 7);

/** Phase 5: readonly FE preview. Real shifts must come from the scoped Shift API. */
@Component({
  selector: 'app-admin-staff-schedule',
  standalone: true,
  imports: [AdminCatalogShellComponent, RouterLink],
  templateUrl: './admin-staff-schedule.component.html',
  styleUrl: './admin-staff-schedule.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminStaffScheduleComponent {
  readonly monday = signal(mondayOf(todayIso()));
  readonly branch = signal('ALL');
  readonly role = signal('ALL');
  readonly page = signal(1);
  readonly pageSize = 6;
  readonly roles = Object.entries(JOB_LABELS) as [JobRole, string][];
  readonly branches = [...new Set(STAFF_PREVIEW.flatMap(staff => staff.branches))];
  readonly days = computed(() => Array.from({ length: 7 }, (_, index) => {
    const iso = dateFor(this.monday(), index);
    return {
      iso,
      weekday: index === 6 ? 'CN' : 'Thứ ' + (index + 2),
      dayMonth: readable(iso),
    };
  }));
  readonly weekLabel = computed(() => readable(this.monday()) + ' – ' +
    readable(dateFor(this.monday(), 6)) + '/' + dateFor(this.monday(), 6).slice(0, 4));
  readonly filtered = computed(() => STAFF_PREVIEW.filter(staff =>
    (this.role() === 'ALL' || staff.jobRole === this.role()) &&
    (this.branch() === 'ALL' || staff.branches.includes(this.branch()))));
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize)));
  readonly rows = computed(() => this.filtered().slice((this.page() - 1) * this.pageSize, this.page() * this.pageSize));
  readonly isSampleWeek = computed(() => this.monday() === '2026-10-19');

  displayName = displayStaffName;
  shifts(staffId: string, iso: string) {
    return STAFF_SHIFTS_PREVIEW.filter(shift =>
      shift.staffId === staffId && shift.isoDate === iso &&
      (this.branch() === 'ALL' || shift.branch === this.branch()));
  }
  selectRole(value: string) { this.role.set(value); this.page.set(1); }
  selectBranch(value: string) { this.branch.set(value); this.page.set(1); }
  changePage(value: number) { if (value >= 1 && value <= this.pageCount()) this.page.set(value); }
  changeWeek(delta: number) { this.monday.set(dateFor(this.monday(), delta * 7)); }
  goToday() { this.monday.set(mondayOf(todayIso())); }
  selectDate(value: string) { if (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))) this.monday.set(mondayOf(value)); }
}

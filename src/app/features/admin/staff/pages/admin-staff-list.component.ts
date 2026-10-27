import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { RouterLink } from '@angular/router';
import { JOB_LABELS, StaffPreview, JobRole, StaffStatus, displayStaffName, displayStaffShift } from '../models/staff-preview.model';
import { AdminStaffApiService, staffTodayISO, staffWeekMonday } from '../services/admin-staff-api.service';

@Component({
  selector: 'app-admin-staff-list',
  standalone: true,
  imports: [AdminCatalogShellComponent, FormsModule, RouterLink],
  templateUrl: './admin-staff-list.component.html',
  styleUrl: './admin-staff-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminStaffListComponent {
  readonly staffApi = inject(AdminStaffApiService);
  readonly loading = this.staffApi.loading;
  readonly error = this.staffApi.error;
  readonly shiftError = this.staffApi.shiftError;
  constructor() {
    this.staffApi.loadRoster();
    effect(() => {
      if (this.staffApi.loaded()) this.staffApi.loadWeek(staffWeekMonday(staffTodayISO()));
    });
  }
  retry(): void { this.staffApi.loadRoster(true); }
  readonly pageSize = 6;
  readonly roles = JOB_LABELS;
  readonly roleChoices = Object.keys(JOB_LABELS) as JobRole[];
  readonly branches = computed(() => [...new Set(this.staffApi.staff().flatMap(s => s.branches))].sort());
  readonly query = signal('');
  readonly roleFilter = signal<JobRole | 'ALL'>('ALL');
  readonly branchFilter = signal('ALL');
  readonly statusFilter = signal<StaffStatus | 'ALL'>('ALL');
  readonly page = signal(1);
  readonly filtered = computed(() => {
    const q = this.query().trim().toLocaleLowerCase('vi');
    return this.staffApi.staff().filter(s =>
      (!q || [s.id, s.fullName, this.displayName(s)].some(v => v.toLocaleLowerCase('vi').includes(q))) &&
      (this.roleFilter() === 'ALL' || s.jobRole === this.roleFilter()) &&
      (this.branchFilter() === 'ALL' || s.branches.includes(this.branchFilter())) &&
      (this.statusFilter() === 'ALL' || s.accountStatus === this.statusFilter()),
    );
  });
  readonly pages = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize)));
  readonly pageNumbers = computed(() => {
    const total = this.pages();
    const current = this.page();
    const start = Math.max(1, Math.min(current - 1, total - 2));
    return Array.from({ length: Math.min(3, total) }, (_, index) => start + index);
  });
  readonly rows = computed(() => this.filtered().slice((this.page() - 1) * this.pageSize, this.page() * this.pageSize));

  displayName(staff: StaffPreview): string {
    // fullName stays raw; prefix is presentation-only.
    return displayStaffName(staff);
  }
  roleName(role: JobRole): string { return JOB_LABELS[role]; }
  staffCode(staff: StaffPreview): string { return staff.staffCode || staff.id; }
  accountLabel(staff: StaffPreview): string {
    return staff.accountStatus === 'ACTIVE' ? 'Đang hoạt động' :
      staff.accountStatus === 'BLOCKED' ? 'Đã chặn' : 'Chưa có dữ liệu';
  }
  todayShift(staff: StaffPreview): string {
    if (this.staffApi.shiftError()) return 'Không tải được';
    if (this.staffApi.loadedMonday() !== staffWeekMonday(staffTodayISO())) return 'Đang tải...';
    const shifts = this.staffApi.shifts().filter(shift => shift.staffId === staff.id && shift.isoDate === staffTodayISO());
    return shifts.length ? shifts.map(shift => this.displayShift(shift.time)).join('; ') : '—';
  }

  // Display-only formatting; preserve the original Shift start/end values.
  displayShift(value: string): string {
    return displayStaffShift(value);
  }

  updateQuery(value: string): void { this.query.set(value); this.page.set(1); }
  updateRole(value: string): void { this.roleFilter.set(value as JobRole | 'ALL'); this.page.set(1); }
  updateBranch(value: string): void { this.branchFilter.set(value); this.page.set(1); }
  updateStatus(value: string): void { this.statusFilter.set(value as StaffStatus | 'ALL'); this.page.set(1); }
  changePage(next: number): void { if (next > 0 && next <= this.pages()) this.page.set(next); }
  clearFilters(): void {
    this.query.set(''); this.roleFilter.set('ALL'); this.branchFilter.set('ALL');
    this.statusFilter.set('ALL'); this.page.set(1);
  }
}

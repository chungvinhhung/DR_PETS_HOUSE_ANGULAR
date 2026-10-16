import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';

type JobRole = 'VETERINARIAN' | 'NURSE' | 'RECEPTIONIST' | 'CARE_STAFF' | 'MANAGER';
type StaffStatus = 'ACTIVE' | 'BLOCKED';

interface StaffPreview {
  id: string;
  fullName: string;
  jobRole: JobRole;
  branches: string[];
  todayShift: string;
  accountStatus: StaffStatus;
}

const JOB_LABELS: Record<JobRole, string> = {
  VETERINARIAN: 'Bác sĩ thú y',
  NURSE: 'Y tá',
  RECEPTIONIST: 'Lễ tân',
  CARE_STAFF: 'Nhân viên chăm sóc',
  MANAGER: 'Quản lý',
};
const JOB_PREFIX: Record<JobRole, string> = {
  VETERINARIAN: 'BS.',
  NURSE: 'YT.',
  RECEPTIONIST: 'LT.',
  CARE_STAFF: 'CS.',
  MANAGER: 'QL.',
};

// Figma-like FE preview fixtures only. No real staffing/Shift/permissions are inferred.
const STAFF_PREVIEW: readonly StaffPreview[] = [
  { id: 'NV001', fullName: 'Minh Anh', jobRole: 'VETERINARIAN', branches: ['Quận 1'], todayShift: '07:00–15:00', accountStatus: 'ACTIVE' },
  { id: 'NV002', fullName: 'Gia Bảo', jobRole: 'CARE_STAFF', branches: ['Quận 3'], todayShift: '08:00–17:00', accountStatus: 'ACTIVE' },
  { id: 'NV003', fullName: 'Thu Hà', jobRole: 'MANAGER', branches: ['Quận 1', 'Quận 3'], todayShift: '—', accountStatus: 'ACTIVE' },
  { id: 'NV004', fullName: 'Quốc Huy', jobRole: 'RECEPTIONIST', branches: ['Bình Thạnh'], todayShift: '08:00–16:00', accountStatus: 'ACTIVE' },
  { id: 'NV005', fullName: 'Thanh Huy', jobRole: 'RECEPTIONIST', branches: ['Quận 10'], todayShift: '07:00–15:00', accountStatus: 'ACTIVE' },
  { id: 'NV006', fullName: 'Phương Vy', jobRole: 'NURSE', branches: ['Thủ Đức', 'Bình Thạnh'], todayShift: '—', accountStatus: 'BLOCKED' },
  { id: 'NV007', fullName: 'Hoàng Khang', jobRole: 'CARE_STAFF', branches: ['Quận 3'], todayShift: '08:00–17:00', accountStatus: 'ACTIVE' },
];

@Component({
  selector: 'app-admin-staff-list',
  standalone: true,
  imports: [AdminCatalogShellComponent, FormsModule],
  templateUrl: './admin-staff-list.component.html',
  styleUrl: './admin-staff-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminStaffListComponent {
  readonly pageSize = 6;
  readonly roles = JOB_LABELS;
  readonly roleChoices = Object.keys(JOB_LABELS) as JobRole[];
  readonly branches = [...new Set(STAFF_PREVIEW.flatMap(s => s.branches))].sort();
  readonly query = signal('');
  readonly roleFilter = signal<JobRole | 'ALL'>('ALL');
  readonly branchFilter = signal('ALL');
  readonly statusFilter = signal<StaffStatus | 'ALL'>('ALL');
  readonly page = signal(1);
  readonly filtered = computed(() => {
    const q = this.query().trim().toLocaleLowerCase('vi');
    return STAFF_PREVIEW.filter(s =>
      (!q || [s.id, s.fullName, this.displayName(s)].some(v => v.toLocaleLowerCase('vi').includes(q))) &&
      (this.roleFilter() === 'ALL' || s.jobRole === this.roleFilter()) &&
      (this.branchFilter() === 'ALL' || s.branches.includes(this.branchFilter())) &&
      (this.statusFilter() === 'ALL' || s.accountStatus === this.statusFilter()),
    );
  });
  readonly pages = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize)));
  readonly rows = computed(() => this.filtered().slice((this.page() - 1) * this.pageSize, this.page() * this.pageSize));

  displayName(staff: StaffPreview): string {
    // fullName stays raw; prefix is presentation-only.
    return `${JOB_PREFIX[staff.jobRole]} ${staff.fullName}`;
  }
  roleName(role: JobRole): string { return JOB_LABELS[role]; }

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

import { ChangeDetectionStrategy, ChangeDetectorRef, Component, effect, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminStaffWeekNavComponent } from '../components/admin-staff-week-nav.component';
import { formatStaffWeekRange } from '../utils/staff-week-range';
import { AdminToastService, adminErrorMessage } from '../../../../shared/services/admin-toast.service';
import { forkJoin, finalize } from 'rxjs';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AdminStaffApiService, staffTodayISO, staffWeekMonday } from '../services/admin-staff-api.service';
import { AdminUsersService } from '../../users/services/admin-users.service';
import {
  JOB_LABELS, JOB_PREFIX, JobRole, STAFF_SHIFTS_PREVIEW,
  StaffPreview, StaffShiftPreview,
} from '../models/staff-preview.model';

const JOB_ROLES = (Object.keys(JOB_LABELS) as JobRole[])
  .filter(role => role !== 'UNKNOWN' && role !== 'MANAGER');
const STRONG_PASSWORD = /^(?=.*[A-Z])(?=.*[0-9]).{8,}$/;
const PHONE = /^0[0-9]{9}$/;
const WEEK_MS = 7 * 86400000;

interface ShiftDay {
  key: string;
  label: string;
  weekday: string;
  dayMonth: string;
  branch: string;
  template: string;
  hours: string;
}

/** FE-only editor: validated local draft, no fabricated backend persistence. */
@Component({
  selector: 'app-admin-staff-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AdminCatalogShellComponent, AdminStaffWeekNavComponent],
  templateUrl: './admin-staff-form.component.html',
  styleUrl: './admin-staff-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminStaffFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(AdminToastService);
  private readonly session = inject(AuthSessionService);
  private readonly cdr = inject(ChangeDetectorRef);
  readonly staffApi = inject(AdminStaffApiService);
  private readonly usersApi = inject(AdminUsersService);
  private hydrated = false;

  readonly isEdit = this.route.snapshot.data['mode'] === 'edit';
  readonly staffId = this.route.snapshot.paramMap.get('id') ?? '';
  get staff(): StaffPreview | undefined { return this.staffApi.staff().find(s => s.id === this.staffId); }
  readonly roles = JOB_ROLES;
  readonly labels = JOB_LABELS;
  get branches(): string[] { return this.staffApi.branches().map(b => b.name); }
  readonly form = this.fb.nonNullable.group({
    fullName: [this.staff?.fullName ?? '', [Validators.required, Validators.maxLength(120)]],
    jobRole: [this.staff?.jobRole ?? 'VETERINARIAN' as JobRole, Validators.required],
    phone: [(this.staff?.phone ?? '').replace(/\s/g, ''), Validators.pattern(PHONE)],
    email: [this.staff?.email ?? '', Validators.email],
    homeBranch: [this.staff?.homeBranch ?? this.staff?.branches[0] ?? '', Validators.required],
    assignedBranches: [this.staff?.branches.join(',') ?? '', Validators.required],
    loginIdentifier: [this.staff?.loginUsername ?? ''],
    password: [''],
  });

  submitted = false;
  showPassword = false;
  resetPasswordOpen = false;
  accountStatusDialogOpen = false;
  accountStatusBusy = false;
  newPassword = '';
  confirmPassword = '';
  resetVisible = false;
  resetConfirmVisible = false;
  resetError = '';
  resetBusy = false;
  saving = false;

  get canManageAccount(): boolean {
    return this.isEdit && this.session.hasAnyRole(['ADMIN']) && !!this.staff?.userId;
  }

  openAccountStatusDialog(): void {
    if (!this.canManageAccount || !this.staff) return;
    this.accountStatusDialogOpen = true;
  }
  closeAccountStatusDialog(): void {
    this.accountStatusDialogOpen = false;
  }
  confirmAccountStatusPreview(): void {
    const staff = this.staff;
    if (!this.canManageAccount || !staff?.userId || this.accountStatusBusy) return;
    const next = staff.accountStatus === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED';
    this.accountStatusBusy = true;
    this.usersApi.updateStatus(staff.userId, { accountStatus: next })
      .pipe(finalize(() => { this.accountStatusBusy = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: () => {
          this.accountStatusDialogOpen = false;
          this.staffApi.loadRoster(true);
          this.toast.show(next === 'BLOCKED' ? 'Đã chặn tài khoản nhân viên.' : 'Đã bỏ chặn tài khoản nhân viên.', 'success');
        },
        error: err => this.toast.show(adminErrorMessage(err, 'Không thể cập nhật trạng thái tài khoản.'), 'error'),
      });
  }

  openResetPassword(): void {
    if (!this.canManageAccount || !this.staff) {
      this.toast.show('Chỉ Admin được đặt lại mật khẩu nhân viên.', 'error');
      return;
    }
    this.newPassword = '';
    this.confirmPassword = '';
    this.resetVisible = false;
    this.resetConfirmVisible = false;
    this.resetError = '';
    this.resetPasswordOpen = true;
  }
  closeResetPassword(): void {
    this.resetPasswordOpen = false;
    this.newPassword = '';
    this.confirmPassword = '';
    this.resetError = '';
  }
  validateResetPassword(): void {
    if (!this.canManageAccount || !this.staff || this.resetBusy) return;
    if (!STRONG_PASSWORD.test(this.newPassword)) {
      this.resetError = 'Mật khẩu cần ít nhất 8 ký tự, có chữ hoa và chữ số.';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.resetError = 'Xác nhận mật khẩu mới không khớp.';
      return;
    }
    this.resetError = '';
    this.resetBusy = true;
    this.staffApi.resetStaffPassword(this.staff.id, this.newPassword)
      .pipe(finalize(() => { this.resetBusy = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: () => {
          this.toast.show('Đã đặt lại mật khẩu nhân viên.', 'success');
          this.closeResetPassword();
          this.cdr.markForCheck();
        },
        error: err => {
          this.resetError = adminErrorMessage(err, 'Không thể đặt lại mật khẩu. Vui lòng thử lại.');
          this.cdr.markForCheck();
        },
      });
  }

  branchMenuOpen = false;
  selectedBranches = new Set<string>(this.staff?.branches ?? []);
  leaveDialogOpen = false;
  private leaveResolver: ((allowed: boolean) => void) | null = null;
  private allowNavigation = false;

  // Figma edit page uses a 7-day table. This is a local preview, not a BE shift write.
  weekMonday = staffWeekMonday(staffTodayISO());
  shifts: Record<string, { branch: string; template: string }> = {};
  shiftDraftDirty = false;

  constructor() {
    this.form.controls.loginIdentifier.disable({ emitEvent: false });
    this.form.controls.password.disable({ emitEvent: false });
    if (this.isEdit) {
      this.form.controls.fullName.disable({ emitEvent: false });
      this.form.controls.phone.disable({ emitEvent: false });
      this.form.controls.email.disable({ emitEvent: false });
    }
    this.staffApi.loadRoster();
    effect(() => {
      const staff = this.staff;
      if (this.isEdit && staff && !this.hydrated && !this.form.dirty) {
        this.form.patchValue({
          fullName: staff.fullName === 'Chưa cập nhật họ tên' ? '' : staff.fullName,
          jobRole: staff.jobRole === 'UNKNOWN' ? 'VETERINARIAN' : staff.jobRole,
          phone: (staff.phone ?? '').replace(/\\s/g, ''),
          email: staff.email ?? '',
          homeBranch: staff.homeBranch ?? '',
          assignedBranches: staff.branches.join(','),
          loginIdentifier: staff.loginUsername ?? '',
        }, { emitEvent: false });
        this.selectedBranches = new Set(staff.branches);
        this.form.markAsPristine();
        this.hydrated = true;
        this.cdr.markForCheck();
      }
      if (this.staffApi.loaded()) this.staffApi.loadWeek(this.weekMonday);
    });
    effect(() => {
      const shifts = this.staffApi.shifts();
      if (!this.shiftDraftDirty && this.staffApi.loadedMonday() === this.weekMonday && this.isEdit) {
        this.shifts = Object.fromEntries(shifts.filter(s => s.staffId === this.staffId)
          .map(s => [s.isoDate, { branch: s.branch, template: s.shiftName }]));
        this.cdr.markForCheck();
      }
    });
  }

  get hasStaff(): boolean { return !this.isEdit || !!this.staff; }
  get displayName(): string {
    const name = this.form.controls.fullName.value.trim();
    return name ? `${JOB_PREFIX[this.form.controls.jobRole.value]} ${name}` : 'Chưa nhập họ tên';
  }
  get branchText(): string {
    const count = this.selectedBranches.size;
    return count ? [...this.selectedBranches].join(', ') : 'Chọn một hoặc nhiều chi nhánh';
  }
  get weekLabel(): string { return formatStaffWeekRange(this.weekMonday); }
  get weekDays(): ShiftDay[] {
    const monday = new Date(this.weekMonday + 'T00:00:00Z').getTime();
    return Array.from({ length: 7 }, (_, n) => {
      const date = new Date(monday + n * 86400000);
      const iso = date.toISOString().slice(0, 10);
      const value = this.shifts[iso];
      return {
        key: iso,
        label: `${n === 6 ? 'CN' : 'T' + (n + 2)} · ${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
        weekday: n === 6 ? 'CN' : 'T' + (n + 2),
        dayMonth: `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
        branch: value?.branch ?? '',
        template: value?.template ?? '',
        hours: value ? this.templateHours(value.template, iso) : '—',
      };
    });
  }
  templateHours(template: string, iso: string): string {
    const fixture: StaffShiftPreview | undefined = STAFF_SHIFTS_PREVIEW.find(s => s.staffId === this.staffId && s.isoDate === iso && s.shiftName === template);
    if (fixture) return fixture.time.replace('–', ' - ');
    return template === 'Ca sáng' ? '07:00 - 15:00' : template === 'Ca chiều' ? '15:00 - 22:00' : '—';
  }
  changeWeek(delta: number): void {
    this.weekMonday = new Date(new Date(this.weekMonday + 'T00:00:00Z').getTime() + delta * WEEK_MS).toISOString().slice(0, 10);
    this.staffApi.loadWeek(this.weekMonday);
  }
  goToday(): void {
    const today = new Date();
    const dayOffset = (today.getDay() + 6) % 7;
    today.setDate(today.getDate() - dayOffset);
    this.weekMonday = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
    this.staffApi.loadWeek(this.weekMonday);
  }
  selectWeekDate(value: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    const date = new Date(value + 'T00:00:00Z');
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return;
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    this.weekMonday = date.toISOString().slice(0, 10);
    this.staffApi.loadWeek(this.weekMonday);
  }
  setShift(iso: string, field: 'branch' | 'template', value: string): void {
    const previous = this.shifts[iso] ?? { branch: '', template: '' };
    this.shifts = { ...this.shifts, [iso]: { ...previous, [field]: value } };
    if (!this.shifts[iso].template) this.shifts[iso] = { branch: '', template: '' };
    this.shiftDraftDirty = true;
  }

  toggleBranchMenu(): void { this.branchMenuOpen = !this.branchMenuOpen; }
  selectHomeBranch(branch: string): void {
    this.form.controls.homeBranch.setValue(branch);
    if (branch && !this.selectedBranches.has(branch)) {
      this.toggleBranch(branch, true);
    }
  }
  toggleBranch(branch: string, checked: boolean): void {
    if (checked) this.selectedBranches.add(branch);
    else this.selectedBranches.delete(branch);
    this.selectedBranches = new Set(this.selectedBranches);
    this.form.controls.assignedBranches.setValue([...this.selectedBranches].join(','));
    this.form.controls.assignedBranches.markAsDirty();
    if (!this.selectedBranches.has(this.form.controls.homeBranch.value)) {
      this.form.controls.homeBranch.setValue('');
    }
  }
  fieldError(field: 'fullName' | 'jobRole' | 'phone' | 'email' | 'homeBranch' | 'assignedBranches' | 'loginIdentifier' | 'password'): string {
    const control = this.form.controls[field];
    if (!control.invalid || !(control.touched || this.submitted)) return '';
    if (control.hasError('required')) return 'Vui lòng nhập/chọn thông tin bắt buộc.';
    if (field === 'email') return 'Email không đúng định dạng.';
    if (field === 'phone') return 'Số điện thoại phải có 10 chữ số và bắt đầu bằng 0.';
    if (field === 'password') return 'Mật khẩu cần ít nhất 8 ký tự, có chữ hoa và chữ số.';
    return 'Giá trị không hợp lệ.';
  }
  submit(intent: 'save' | 'assign'): void {
    this.submitted = true;
    this.form.markAllAsTouched();
    if (this.saving) return;
    if (!this.hasStaff) {
      this.toast.show('Không tìm thấy hồ sơ nhân viên.', 'error');
      return;
    }
    const homeBranchName = this.form.controls.homeBranch.value;
    if (!this.selectedBranches.size || !homeBranchName || !this.selectedBranches.has(homeBranchName)) {
      this.toast.show('Vui lòng chọn chi nhánh làm việc phù hợp với chi nhánh chính.', 'error');
      return;
    }
    if (this.form.invalid) {
      this.toast.show('Vui lòng kiểm tra các trường được đánh dấu lỗi.', 'error');
      return;
    }
    const branchIds = [...this.selectedBranches]
      .map(name => this.staffApi.branches().find(branch => branch.name === name)?.id ?? '')
      .filter(Boolean);
    const homeBranchId = this.staffApi.branches().find(branch => branch.name === homeBranchName)?.id ?? '';
    if (!branchIds.length || !homeBranchId) {
      this.toast.show('Không xác định được mã chi nhánh. Vui lòng tải lại dữ liệu.', 'error');
      return;
    }
    const role = this.form.controls.jobRole.value === 'CARE_STAFF'
      ? 'CARE_STAFF_GROOMER'
      : this.form.controls.jobRole.value;
    if (!['RECEPTIONIST', 'CARE_STAFF_GROOMER', 'VETERINARIAN', 'NURSE'].includes(role)) {
      this.toast.show('Vai trò nhân viên chưa hợp lệ.', 'error');
      return;
    }
    this.saving = true;
    if (!this.isEdit) {
      this.staffApi.createStaff({
        fullName: this.form.controls.fullName.value.trim(),
        phone: this.form.controls.phone.value.trim() || undefined,
        email: this.form.controls.email.value.trim() || undefined,
        staffSubRole: role as 'RECEPTIONIST' | 'CARE_STAFF_GROOMER' | 'VETERINARIAN' | 'NURSE',
        authorizedBranchIds: branchIds,
        homeBranchId,
      }).pipe(finalize(() => { this.saving = false; this.cdr.markForCheck(); })).subscribe({
        next: created => {
          this.allowNavigation = true;
          this.staffApi.loadRoster(true);
          const credentials = created.credentials;
          this.toast.show(credentials
            ? `Đã tạo nhân viên. Tài khoản: ${credentials.username} · Mật khẩu tạm: ${credentials.password}`
            : 'Đã tạo nhân viên.', 'success');
          void this.router.navigateByUrl(intent === 'assign'
            ? '/admin/staff/shifts/assign?staffId=' + encodeURIComponent(created.id)
            : '/admin/staff/' + encodeURIComponent(created.id));
        },
        error: err => this.toast.show(adminErrorMessage(err, 'Không thể tạo nhân viên. Vui lòng thử lại.'), 'error'),
      });
      return;
    }

    const staff = this.staff;
    if (!staff) {
      this.saving = false;
      return;
    }
    forkJoin([
      this.staffApi.updateStaffRole(staff.id, role as 'RECEPTIONIST' | 'CARE_STAFF_GROOMER' | 'VETERINARIAN' | 'NURSE'),
      this.staffApi.updateStaffBranches(staff.id, { homeBranchId, authorizedBranchIds: branchIds }),
    ]).pipe(finalize(() => { this.saving = false; this.cdr.markForCheck(); })).subscribe({
      next: () => {
        this.staffApi.loadRoster(true);
        this.form.markAsPristine();
        this.selectedBranches = new Set(this.selectedBranches);
        this.toast.show('Đã cập nhật vai trò và phân công chi nhánh.', 'success');
      },
      error: err => this.toast.show(adminErrorMessage(err, 'Không thể lưu thay đổi nhân viên. Vui lòng thử lại.'), 'error'),
    });
  }
  notAvailable(action: string): void {
    this.toast.show(`${action} đang chờ API Backend và phân quyền Admin.`, 'info');
  }

  hasChanges(): boolean { return this.form.dirty || this.shiftDraftDirty; }
  canLeavePage(): boolean | Promise<boolean> {
    if (this.allowNavigation || !this.hasChanges()) return true;
    if (this.leaveResolver) return false;
    this.leaveDialogOpen = true;
    this.cdr.markForCheck();
    return new Promise<boolean>(resolve => { this.leaveResolver = resolve; });
  }
  resolveLeave(confirmed: boolean): void {
    this.leaveDialogOpen = false;
    this.allowNavigation = confirmed;
    const resolver = this.leaveResolver;
    this.leaveResolver = null;
    resolver?.(confirmed);
    this.cdr.markForCheck();
  }
  cancel(): void {
    const fromDetail = this.isEdit && !!this.staff && this.route.snapshot.queryParamMap.get('from') === 'detail';
    const target = fromDetail ? `/admin/staff/${this.staffId}` : '/admin/staff';
    void this.router.navigateByUrl(target);
  }
  @HostListener('window:beforeunload', ['$event'])
  confirmBrowserUnload(event: BeforeUnloadEvent): void {
    if (!this.hasChanges()) return;
    event.preventDefault();
    event.returnValue = '';
  }
}

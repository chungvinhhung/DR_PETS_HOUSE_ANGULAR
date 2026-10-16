import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { JOB_LABELS, JOB_PREFIX, JobRole, STAFF_PREVIEW, StaffPreview } from '../models/staff-preview.model';

const JOB_ROLES = Object.keys(JOB_LABELS) as JobRole[];
const BRANCHES = ['Quận 1', 'Quận 3', 'Quận 10', 'Bình Thạnh', 'Thủ Đức'];
const STRONG_PASSWORD = /^(?=.*[A-Z])(?=.*[0-9]).{8,}$/;
const PHONE = /^(?:0[0-9]{9})$/;

/** Phase 3 form preview. Never persists unimplemented Staff or credentials. */
@Component({
  selector: 'app-admin-staff-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AdminCatalogShellComponent],
  templateUrl: './admin-staff-form.component.html',
  styleUrl: './admin-staff-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminStaffFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly isEdit = this.route.snapshot.data['mode'] === 'edit';
  readonly staffId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly staff: StaffPreview | undefined = STAFF_PREVIEW.find(s => s.id === this.staffId);
  readonly roles = JOB_ROLES;
  readonly labels = JOB_LABELS;
  readonly branches = BRANCHES;
  readonly accountName = this.staff?.loginUsername ?? '';
  readonly form = this.fb.nonNullable.group({
    fullName: [this.staff?.fullName ?? '', [Validators.required, Validators.maxLength(120)]],
    jobRole: [this.staff?.jobRole ?? 'VETERINARIAN' as JobRole, Validators.required],
    phone: [(this.staff?.phone ?? '').replace(/\s/g, ''), Validators.pattern(PHONE)],
    email: [this.staff?.email ?? '', Validators.email],
    homeBranch: [this.staff?.homeBranch ?? this.staff?.branches[0] ?? '', Validators.required],
    assignedBranches: [this.staff?.branches.join(',') ?? '', Validators.required],
    loginIdentifier: [this.staff?.loginUsername ?? '', Validators.required],
    password: ['', this.isEdit ? [] : [Validators.required, Validators.pattern(STRONG_PASSWORD)]],
    confirmPassword: ['', this.isEdit ? [] : Validators.required],
    requirePasswordChange: [true],
  });
  submitted = false;
  showPassword = false;
  showConfirm = false;
  notice = '';
  showDiscard = false;
  selectedBranches = new Set<string>(this.staff?.branches ?? []);
  readonly branchChoices = BRANCHES;

  constructor() {
    if (this.isEdit) {
      this.form.controls.loginIdentifier.disable();
    }
  }

  get displayName(): string {
    const name = this.form.controls.fullName.value.trim();
    return name ? `${JOB_PREFIX[this.form.controls.jobRole.value]} ${name}` : 'Chưa nhập họ tên';
  }
  get hasStaff(): boolean { return !this.isEdit || !!this.staff; }
  get passwordMismatch(): boolean {
    return !this.isEdit && this.form.controls.confirmPassword.value !== this.form.controls.password.value;
  }
  toggleBranch(branch: string, checked: boolean): void {
    if (checked) this.selectedBranches.add(branch);
    else this.selectedBranches.delete(branch);
    this.form.controls.assignedBranches.setValue([...this.selectedBranches].join(','));
    this.form.controls.assignedBranches.markAsDirty();
    if (!this.selectedBranches.has(this.form.controls.homeBranch.value)) {
      this.form.controls.homeBranch.setValue('');
    }
  }
  fieldError(field: 'fullName'|'jobRole'|'phone'|'email'|'homeBranch'|'assignedBranches'|'loginIdentifier'|'password'|'confirmPassword'): string {
    const control = this.form.controls[field];
    if (!control.invalid || !(control.touched || this.submitted)) return '';
    if (control.hasError('required')) return 'Vui lòng nhập/chọn thông tin bắt buộc.';
    if (field === 'email') return 'Email không đúng định dạng.';
    if (field === 'phone') return 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0.';
    if (field === 'password') return 'Mật khẩu cần ít nhất 8 ký tự, có chữ hoa và chữ số.';
    return 'Giá trị chưa hợp lệ.';
  }
  submit(intent: 'save'|'assign'): void {
    this.submitted = true;
    this.form.markAllAsTouched();
    this.notice = '';
    if (!this.hasStaff) { this.notice = 'Không tìm thấy nhân viên mẫu.'; return; }
    if (!this.selectedBranches.size || !this.selectedBranches.has(this.form.controls.homeBranch.value)) {
      this.notice = 'Chọn tối thiểu một chi nhánh và bảo đảm chi nhánh chính thuộc danh sách được phân công.';
      return;
    }
    if (!this.isEdit && this.passwordMismatch) {
      this.notice = 'Xác nhận mật khẩu không khớp.';
      return;
    }
    if (this.form.invalid) return;
    this.notice = intent === 'assign'
      ? 'Biểu mẫu hợp lệ. Chưa có API tạo nhân viên; không thể chuyển sang phân ca khi chưa có staffId thật.'
      : 'Biểu mẫu hợp lệ, nhưng chưa kết nối API Staff/Account. Không có dữ liệu nào được lưu.';
  }
  canLeavePage(): boolean {
    return !this.form.dirty || this.showDiscard || window.confirm('Hủy các thay đổi chưa lưu?');
  }
  cancel(): void {
    if (this.form.dirty) { this.showDiscard = true; return; }
    void this.router.navigateByUrl(this.isEdit && this.staff ? `/admin/staff/${this.staffId}` : '/admin/staff');
  }
  discard(): void {
    this.showDiscard = false;
    this.form.markAsPristine();
    void this.router.navigateByUrl(this.isEdit && this.staff ? `/admin/staff/${this.staffId}` : '/admin/staff');
  }
}

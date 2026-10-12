import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { AppHttpError } from '../../../../../core/models/app-http-error.model';
import { AdminAuthService } from '../../services/admin-auth.service';

type LoginControlName = 'identifier' | 'password';

@Component({
  selector: 'app-admin-login-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './admin-login-page.component.html',
  styleUrl: './admin-login-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLoginPageComponent {
  readonly passwordVisible = signal(false);
  readonly submitted = signal(false);
  readonly isSubmitting = signal(false);
  readonly apiError = signal<string | null>(null);

  readonly form = this.formBuilder.nonNullable.group({
    identifier: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  constructor(
    private readonly formBuilder: FormBuilder,
    private readonly adminAuth: AdminAuthService,
    private readonly router: Router,
  ) {}

  togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  submit(): void {
    this.submitted.set(true);
    this.apiError.set(null);
    this.form.markAllAsTouched();

    if (this.form.invalid || this.isSubmitting()) {
      return;
    }

    this.isSubmitting.set(true);

    const { identifier, password } = this.form.getRawValue();

    this.adminAuth
      .login({
        identifier: identifier.trim(),
        password,
        rememberMe: false,
      })
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => {
          void this.router.navigateByUrl('/admin/dashboard');
        },
        error: (error: unknown) => {
          this.apiError.set(this.loginErrorMessage(error));
        },
      });
  }

  showError(controlName: LoginControlName): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || this.submitted());
  }

  private loginErrorMessage(error: unknown): string {
    if (!(error instanceof AppHttpError)) {
      return 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.';
    }

    const code = this.backendErrorCode(error.details);

    switch (code) {
      case 'INVALID_CREDENTIALS':
        return 'Số điện thoại/email hoặc mật khẩu không đúng.';
      case 'ACCOUNT_NOT_ACTIVATED':
        return 'Tài khoản chưa được kích hoạt. Vui lòng xác thực OTP.';
      case 'ACCOUNT_BLOCKED':
        return 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.';
      case 'ACCOUNT_LOCKED':
        return 'Tài khoản đang tạm khóa do đăng nhập sai nhiều lần. Vui lòng thử lại sau.';
      default:
        if (error.kind === 'network') {
          return 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra Backend đang chạy.';
        }

        return error.message || 'Đăng nhập thất bại. Vui lòng thử lại.';
    }
  }

  private backendErrorCode(details: unknown): string | null {
    if (
      typeof details === 'object' &&
      details !== null &&
      'code' in details &&
      typeof (details as { code?: unknown }).code === 'string'
    ) {
      return (details as { code: string }).code;
    }

    return null;
  }
}

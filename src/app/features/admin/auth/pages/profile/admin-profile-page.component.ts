import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { AppHttpError } from '../../../../../core/models/app-http-error.model';
import { AuthSessionService } from '../../../../../core/services/auth-session.service';
import { AdminCatalogShellComponent } from '../../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminProfileService } from '../../services/admin-profile.service';

@Component({
  selector: 'app-admin-profile-page',
  standalone: true,
  imports: [ReactiveFormsModule, AdminCatalogShellComponent],
  templateUrl: './admin-profile-page.component.html',
  styleUrl: './admin-profile-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminProfilePageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly profileService = inject(AdminProfileService);
  private readonly authSession = inject(AuthSessionService);

  readonly user = this.authSession.user;
  readonly saving = signal(false);
  readonly notice = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly changingPassword = signal(false);
  readonly passwordNotice = signal<string | null>(null);
  readonly passwordError = signal<string | null>(null);

  readonly form = this.formBuilder.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    email: ['', [Validators.email]],
  });

  readonly passwordForm = this.formBuilder.nonNullable.group({
    oldPassword: ['', [Validators.required]],
    newPassword: ['', [
      Validators.required,
      Validators.pattern(/^(?=.*[A-Z])(?=.*\d).{8,}$/),
    ]],
    confirmPassword: ['', [Validators.required]],
  });

  constructor() {
    const current = this.user();
    if (current) {
      this.patchForm(current.fullName, current.email);
    }

    this.profileService.getProfile().subscribe({
      next: (user) => this.patchForm(user.fullName, user.email),
      error: (error: unknown) => {
        this.errorMessage.set(this.messageForError(error));
      },
    });
  }

  initials(): string {
    const name = this.user()?.fullName?.trim();
    if (!name) {
      return 'AD';
    }

    return name
      .split(/\s+/)
      .slice(-2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  save(): void {
    this.notice.set(null);
    this.errorMessage.set(null);
    this.form.markAllAsTouched();

    if (this.form.invalid || this.saving()) {
      return;
    }

    const value = this.form.getRawValue();
    this.saving.set(true);

    this.profileService
      .updateProfile({
        fullName: value.fullName.trim(),
        email: value.email.trim() || null,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (user) => {
          this.patchForm(user.fullName, user.email);
          this.notice.set('Đã cập nhật hồ sơ.');
        },
        error: (error: unknown) => {
          this.errorMessage.set(this.messageForError(error));
        },
      });
  }

  changePassword(): void {
    this.passwordNotice.set(null);
    this.passwordError.set(null);
    this.passwordForm.markAllAsTouched();

    if (this.passwordForm.invalid || this.changingPassword()) return;

    const value = this.passwordForm.getRawValue();
    if (value.newPassword !== value.confirmPassword) {
      this.passwordError.set('Mật khẩu xác nhận không khớp.');
      return;
    }

    this.changingPassword.set(true);
    this.profileService.changePassword(value)
      .pipe(finalize(() => this.changingPassword.set(false)))
      .subscribe({
        next: () => {
          this.passwordForm.reset({
            oldPassword: '',
            newPassword: '',
            confirmPassword: '',
          });
          this.passwordNotice.set('Đã đổi mật khẩu.');
        },
        error: (error: unknown) => {
          if (error instanceof AppHttpError) {
            const code = this.backendErrorCode(error.details);
            if (code === 'INVALID_OLD_PASSWORD') {
              this.passwordError.set('Mật khẩu hiện tại không đúng.');
              return;
            }
            if (code === 'PASSWORD_TOO_WEAK') {
              this.passwordError.set('Mật khẩu mới chưa đáp ứng yêu cầu bảo mật.');
              return;
            }
            this.passwordError.set(error.message);
            return;
          }
          this.passwordError.set('Không thể đổi mật khẩu. Vui lòng thử lại.');
        },
      });
  }

  private backendErrorCode(details: unknown): string | null {
    if (typeof details === 'object' && details !== null && 'code' in details &&
        typeof (details as { code?: unknown }).code === 'string') {
      return (details as { code: string }).code;
    }
    return null;
  }

  private patchForm(fullName: string, email: string | null): void {
    this.form.patchValue({
      fullName,
      email: email ?? '',
    });
  }

  private messageForError(error: unknown): string {
    if (error instanceof AppHttpError) {
      return error.message;
    }

    return 'Không thể tải hoặc cập nhật hồ sơ.';
  }
}

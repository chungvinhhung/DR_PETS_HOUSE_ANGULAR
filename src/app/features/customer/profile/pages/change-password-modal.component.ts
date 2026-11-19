import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';

import { AuthApiService } from '../../../../core/customer/services/api/auth-api.service';
import { UserProfileFieldComponent } from './user-profile-field.component';
import { inputClass } from './user-profile-page.helpers';

/**
 * ChangePasswordModal — chuyển từ React: src/pages/User/UserProfilePage.jsx
 */
@Component({
  selector: 'div[app-change-password-modal]',
  standalone: true,
  imports: [UserProfileFieldComponent],
  templateUrl: './change-password-modal.component.html',
  styleUrl: './change-password-modal.component.scss',
  host: {
    'class': 'fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(6,16,90,0.24)] p-4 backdrop-blur-[2px]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePasswordModalComponent {
  // --- Service dùng chung ---
  protected readonly authApi = inject(AuthApiService);

  // --- Input / Output (props của React) ---
  readonly onClose = output<any>();
  readonly onSuccess = output<void>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly inputClass: any = inputClass;

  // --- Trạng thái (signal = useState / useRef) ---
  readonly form = signal<any>({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  readonly error = signal<any>("");
  readonly isSubmitting = signal<any>(false);

  protected updateField(field: any, value: any) {
    this.form.update((current: any) => ({ ...current, [field]: value }));
    this.error.set("");
  }

  protected async handleSubmit(event: any) {
    event.preventDefault();

    if (!this.form().oldPassword || !this.form().newPassword || !this.form().confirmPassword) {
      this.error.set("Vui lòng nhập đầy đủ thông tin.");
      return;
    }

    if (this.form().newPassword !== this.form().confirmPassword) {
      this.error.set("Mật khẩu xác nhận không khớp.");
      return;
    }

    this.isSubmitting.set(true);
    try {
      await this.authApi.changePassword({
        oldPassword: this.form().oldPassword,
        newPassword: this.form().newPassword,
      });
      this.onSuccess.emit();
    } catch (submitError: any) {
      this.error.set(submitError?.message || "Không thể đổi mật khẩu.");
    } finally {
      this.isSubmitting.set(false);
    }
  }
}

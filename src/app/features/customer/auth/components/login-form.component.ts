import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthApiService } from '../../../../core/customer/services/api/auth-api.service';
import { FieldComponent } from './field.component';
import { PrimaryButtonComponent } from './primary-button.component';
import { DividerComponent } from './divider.component';
import { GoogleButtonComponent } from './google-button.component';
import { reactSetter } from '../../../../shared/customer/utils/react-setter';
import { VALIDATION_SCHEMAS, getFormErrors, submitValidatedForm } from './auth-modal.helpers';

/**
 * LoginForm — chuyển từ React: src/components/auth/AuthModal.jsx
 */
@Component({
  selector: 'form[app-login-form]',
  standalone: true,
  imports: [FieldComponent, PrimaryButtonComponent, DividerComponent, GoogleButtonComponent, RouterLink],
  templateUrl: './login-form.component.html',
  styleUrl: './login-form.component.scss',
  host: {
    'novalidate': '',
    'class': 'flex flex-col gap-5',
    '(submit)': 'submitValidatedForm($any($event), errors(), setValidationAttemptedFn, handleSubmitFn)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginFormComponent {
  // --- Service dùng chung ---
  protected readonly authApi = inject(AuthApiService);

  // --- Input / Output (props của React) ---
  readonly form = input<any>(undefined);
  readonly setForm = input<any>(undefined);
  readonly changeScreen = input<any>(undefined);
  readonly completeLogin = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  /** handleSubmit được truyền như một hàm (callback) trong template -> giữ đúng "this" */
  protected readonly handleSubmitFn = this.handleSubmit.bind(this);
  protected readonly submitValidatedForm: any = submitValidatedForm;

  // --- Giá trị tính toán (computed) ---
  readonly errors = computed<any>(() => getFormErrors(this.form(), VALIDATION_SCHEMAS.login));

  // --- Trạng thái (signal = useState / useRef) ---
  readonly validationAttempted = signal<any>(false);
  readonly submitting = signal<any>(false);
  readonly submitError = signal<any>("");

  /** Hàm set kiểu React cho signal "validationAttempted" (dùng khi truyền cho component con / callback) */
  protected readonly setValidationAttemptedFn = reactSetter(this.validationAttempted);

  protected update({ target }: any) {
    return this.setForm()((current: any) => ({ ...current, [target.name]: target.type === "checkbox" ? target.checked : target.value }));
  }

  protected async handleSubmit() {
    this.submitting.set(true);
    this.submitError.set("");
    try {
      const data: any = await this.authApi.login({
        loginId: this.form().phone.trim(),
        password: this.form().password,
        remember: this.form().remember,
      });
      const token = data?.accessToken || data?.access_token || data?.token || data?.data?.accessToken || data?.data?.access_token;
      this.completeLogin()(
        { phone: this.form().phone.trim() },
        {
          remember: this.form().remember,
          accessToken: token,
          user: data?.user || data?.data?.user,
        },
      );
    } catch (error: any) {
      this.submitError.set(error?.message || "Dang nhap khong thanh cong");
    } finally {
      this.submitting.set(false);
    }
  }
}

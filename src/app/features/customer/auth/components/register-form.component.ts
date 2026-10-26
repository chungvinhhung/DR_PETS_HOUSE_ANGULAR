import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { AuthApiService } from '../../../../core/customer/services/api/auth-api.service';
import { FieldComponent } from './field.component';
import { PrimaryButtonComponent } from './primary-button.component';
import { DividerComponent } from './divider.component';
import { GoogleButtonComponent } from './google-button.component';
import { reactSetter } from '../../../../shared/customer/utils/react-setter';
import { VALIDATION_SCHEMAS, getFormErrors, submitValidatedForm } from './auth-modal.helpers';

/**
 * RegisterForm — chuyển từ React: src/components/auth/AuthModal.jsx
 */
@Component({
  selector: 'form[app-register-form]',
  standalone: true,
  imports: [FieldComponent, PrimaryButtonComponent, DividerComponent, GoogleButtonComponent],
  templateUrl: './register-form.component.html',
  host: {
    'novalidate': '',
    'class': 'flex flex-col gap-4',
    '(submit)': 'submitValidatedForm($any($event), errors(), setValidationAttemptedFn, handleSubmitFn)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterFormComponent {
  // --- Service dùng chung ---
  protected readonly authApi = inject(AuthApiService);

  // --- Input / Output (props của React) ---
  readonly form = input<any>(undefined);
  readonly setForm = input<any>(undefined);
  readonly changeScreen = input<any>(undefined);
  readonly updateUserProfile = input<any>(undefined);
  readonly completeLogin = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  /** handleSubmit được truyền như một hàm (callback) trong template -> giữ đúng "this" */
  protected readonly handleSubmitFn = this.handleSubmit.bind(this);
  protected readonly submitValidatedForm: any = submitValidatedForm;

  // --- Giá trị tính toán (computed) ---
  readonly errors = computed<any>(() => getFormErrors(this.form(), VALIDATION_SCHEMAS.register));

  // --- Trạng thái (signal = useState / useRef) ---
  readonly validationAttempted = signal<any>(false);
  readonly submitting = signal<any>(false);
  readonly submitError = signal<any>("");

  /** Hàm set kiểu React cho signal "validationAttempted" (dùng khi truyền cho component con / callback) */
  protected readonly setValidationAttemptedFn = reactSetter(this.validationAttempted);

  protected update({ target }: any) {
    return this.setForm()((current: any) => ({ ...current, [target.name]: target.value }));
  }

  protected async handleSubmit() {
    this.submitting.set(true);
    this.submitError.set("");
    try {
      const data = await this.authApi.register({
        fullName: this.form().name.trim(),
        phone: this.form().phone.trim(),
        email: this.form().email.trim(),
        password: this.form().password,
      });
      this.updateUserProfile()({
        fullName: this.form().name,
        phone: this.form().phone,
        email: this.form().email,
      });
      if (data?.frontendFallback) {
        this.completeLogin()(
          {
            fullName: this.form().name.trim(),
            phone: this.form().phone.trim(),
            email: this.form().email.trim(),
          },
          {
            remember: true,
            accessToken: data.access_token,
            user: data.user,
          },
        );
        return;
      }
      this.changeScreen()("registerOtp");
    } catch (error: any) {
      this.submitError.set(error?.message || "Dang ky khong thanh cong");
    } finally {
      this.submitting.set(false);
    }
  }
}

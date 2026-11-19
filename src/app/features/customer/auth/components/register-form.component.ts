import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { AuthApiService } from '../../../../core/customer/services/api/auth-api.service';
import { FieldComponent } from './field.component';
import { PrimaryButtonComponent } from './primary-button.component';
import { reactSetter } from '../../../../shared/customer/utils/react-setter';
import { VALIDATION_SCHEMAS, getFormErrors, submitValidatedForm } from './auth-modal.helpers';

const PASSWORD_RULES = [
  { key: 'length', label: 'Ít nhất 8 ký tự', test: (value: string) => value.length >= 8 },
  { key: 'upper', label: 'Có chữ in hoa (A–Z)', test: (value: string) => /\p{Lu}/u.test(value) },
  { key: 'lower', label: 'Có chữ thường (a–z)', test: (value: string) => /\p{Ll}/u.test(value) },
  { key: 'number', label: 'Có chữ số (0–9)', test: (value: string) => /\d/.test(value) },
  { key: 'special', label: 'Có ký tự đặc biệt (!@#$%...)', test: (value: string) => /[^\p{L}\p{N}\s]/u.test(value) },
];

const PASSWORD_LEVELS = [
  { index: 0, label: 'Yếu', color: '#e53935' },
  { index: 1, label: 'Trung bình', color: '#fb8c00' },
  { index: 2, label: 'Mạnh', color: '#2e7d32' },
];

@Component({
  selector: 'form[app-register-form]',
  standalone: true,
  imports: [FieldComponent, PrimaryButtonComponent],
  templateUrl: './register-form.component.html',
  styleUrl: './register-form.component.scss',
  host: {
    'novalidate': '',
    'class': 'flex flex-col gap-4',
    '(submit)': 'onSubmit($any($event))',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterFormComponent {
  protected readonly authApi = inject(AuthApiService);

  readonly form = input<any>(undefined);
  readonly setForm = input<any>(undefined);
  readonly changeScreen = input<any>(undefined);
  readonly updateUserProfile = input<any>(undefined);
  readonly completeLogin = input<any>(undefined);

  protected readonly handleSubmitFn = this.handleSubmit.bind(this);
  protected readonly submitValidatedForm: any = submitValidatedForm;
  protected readonly strengthSegments = [0, 1, 2];

    readonly errors = computed<any>(() => {
    const baseErrors = getFormErrors(this.form(), VALIDATION_SCHEMAS.register);
    if (baseErrors?.confirmPassword && !this.form()?.confirmPassword) {
      return { ...baseErrors, confirmPassword: 'Vui lòng nhập lại mật khẩu' };
    }
    return baseErrors;
  });
  
  readonly passwordChecks = computed(() => {
    const password = this.form()?.password ?? '';
    return PASSWORD_RULES.map((rule) => ({ key: rule.key, label: rule.label, passed: rule.test(password) }));
  });

  readonly passwordStrength = computed(() => {
    const password = this.form()?.password ?? '';
    if (!password) return null;
    const passedCount = this.passwordChecks().filter((rule) => rule.passed).length;
    if (passedCount <= 2) return PASSWORD_LEVELS[0];
    if (passedCount <= 4) return PASSWORD_LEVELS[1];
    return PASSWORD_LEVELS[2];
  });

  readonly validationAttempted = signal<any>(false);
  readonly submitting = signal<any>(false);
  readonly submitError = signal<any>("");
  readonly agreedTerms = signal(false);
  readonly showTermsError = signal(false);

  protected readonly setValidationAttemptedFn = reactSetter(this.validationAttempted);

  protected update({ target }: any) {
    return this.setForm()((current: any) => ({ ...current, [target.name]: target.value }));
  }

  protected onAgreeChange(checked: boolean) {
    this.agreedTerms.set(checked);
    if (checked) this.showTermsError.set(false);
  }

  protected onSubmit(event: Event) {
    event.preventDefault();
    if (!this.agreedTerms()) this.showTermsError.set(true);
    this.submitValidatedForm(event, this.errors(), this.setValidationAttemptedFn, this.handleSubmitFn);
  }

  protected async handleSubmit() {
    if (!this.agreedTerms()) {
      this.showTermsError.set(true);
      return;
    }
    this.submitting.set(true);
    this.submitError.set("");
    try {
      const data: any = await this.authApi.register({
        fullName: this.form().name.trim(),
        phone: this.form().phone.trim(),
        email: this.form().email.trim(),
        password: this.form().password,
        confirmPassword: this.form().confirmPassword || this.form().password,
        acceptTerms: true,
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
      if (this.setForm()) {
        this.setForm()((prev: any) => ({
          ...prev,
          debugOtp: data?.debugOtp || '',
          brandName: data?.brandName || 'DRPETSHOUSE',
          channels: data?.channels || ['SMS_BRANDNAME', 'EMAIL'],
          sentTo: data?.sentTo,
        }));
      }
      this.changeScreen()("registerOtp");
    } catch (error: any) {
      this.submitError.set(error?.message || "Đăng ký không thành công");
    } finally {
      this.submitting.set(false);
    }
  }
}
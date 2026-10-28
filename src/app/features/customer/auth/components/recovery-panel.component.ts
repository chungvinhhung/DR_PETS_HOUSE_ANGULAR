import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { AuthApiService } from '../../../../core/customer/services/api/auth-api.service';
import { AuthBackgroundBlobComponent } from './auth-background-blob.component';
import { FieldComponent } from './field.component';
import { PrimaryButtonComponent } from './primary-button.component';
import { OtpFormComponent } from './otp-form.component';
import { CustomerIconComponent } from '../../../../shared/customer/components/icon/customer-icon.component';
import { authImages } from '../../../../shared/customer/assets/auth-images';
import { reactSetter } from '../../../../shared/customer/utils/react-setter';
import { EMAIL_PATTERN, VALIDATION_SCHEMAS, getFormErrors, submitValidatedForm } from './auth-modal.helpers';

/**
 * RecoveryPanel — chuyển từ React: src/components/auth/AuthModal.jsx
 */
@Component({
  selector: 'div[app-recovery-panel]',
  standalone: true,
  imports: [AuthBackgroundBlobComponent, FieldComponent, PrimaryButtonComponent, OtpFormComponent, CustomerIconComponent],
  templateUrl: './recovery-panel.component.html',
  host: {
    'class': 'relative flex w-full flex-col items-center overflow-hidden rounded-xl bg-[#90CAF9] px-5 pb-[15px] pt-14 shadow-2xl md:min-h-[637px] md:flex-row md:p-12',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecoveryPanelComponent {
  // --- Service dùng chung ---
  protected readonly authApi = inject(AuthApiService);

  // --- Input / Output (props của React) ---
  readonly screen = input<any>(undefined);
  readonly forms = input<any>(undefined);
  readonly setForms = input<any>(undefined);
  readonly changeScreen = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  /** handleForgotSubmit được truyền như một hàm (callback) trong template -> giữ đúng "this" */
  protected readonly handleForgotSubmitFn = this.handleForgotSubmit.bind(this);
  /** handleResetSubmit được truyền như một hàm (callback) trong template -> giữ đúng "this" */
  protected readonly handleResetSubmitFn = this.handleResetSubmit.bind(this);
  protected readonly authImages: any = authImages;
  protected readonly submitValidatedForm: any = submitValidatedForm;

  // --- Giá trị tính toán (computed) ---
  readonly forgotErrors = computed<any>(() => getFormErrors(this.forms().forgot, VALIDATION_SCHEMAS.forgot));
  readonly resetErrors = computed<any>(() => getFormErrors(this.forms().reset, VALIDATION_SCHEMAS.reset));
  readonly otpRecipient = computed<any>(() => this.screen() === "registerOtp"
    ? this.forms().register.email.trim() || this.forms().register.phone.trim()
    : this.forms().forgot.account.trim());
  readonly content = computed<any>(() => (({
    forgot: ["Quên mật khẩu?", "Nhập SĐT hoặc email đã đăng ký để nhận mã xác nhận"],
    resetOtp: ["Xác nhận mã OTP", `Chúng tôi đã gửi mã 6 số đến ${this.otpRecipient()}`],
    registerOtp: ["Xác nhận mã OTP", `Chúng tôi đã gửi mã 6 số đến ${this.otpRecipient()}`],
    reset: ["Tạo mật khẩu mới", "Nhập mật khẩu mới cho tài khoản của bạn"],
  } as any)[this.screen()]));

  // --- Trạng thái (signal = useState / useRef) ---
  readonly forgotValidationAttempted = signal<any>(false);
  readonly resetValidationAttempted = signal<any>(false);
  readonly submitting = signal<any>(false);
  readonly submitError = signal<any>("");
  readonly resetToken = signal<any>("");

  /** Hàm set kiểu React cho signal "forgotValidationAttempted" (dùng khi truyền cho component con / callback) */
  protected readonly setForgotValidationAttemptedFn = reactSetter(this.forgotValidationAttempted);
  /** Hàm set kiểu React cho signal "resetValidationAttempted" (dùng khi truyền cho component con / callback) */
  protected readonly setResetValidationAttemptedFn = reactSetter(this.resetValidationAttempted);

  protected update(key: any) {
    return ({ target }: any) =>
    this.setForms()((current: any) => ({ ...current, [key]: { ...(current as any)[key], [target.name]: target.value } }));
  }

  protected async handleForgotSubmit() {
    this.submitting.set(true);
    this.submitError.set("");
    try {
      const account = this.forms().forgot.account.trim();
      if (!EMAIL_PATTERN.test(account)) {
        throw new Error("Backend hien chi ho tro quen mat khau bang email");
      }
      await this.authApi.forgotPassword(account);
      this.changeScreen()("resetOtp");
    } catch (error: any) {
      this.submitError.set(error?.message || "Khong the gui OTP");
    } finally {
      this.submitting.set(false);
    }
  }

  protected async handleOtpSubmit(otpCode: any) {
    this.submitting.set(true);
    this.submitError.set("");
    try {
      if (this.screen() === "registerOtp") {
        await this.authApi.verifyRegisterOtp({
          loginId: this.forms().register.email.trim() || this.forms().register.phone.trim(),
          otpCode,
        });
        this.changeScreen()("success");
        return;
      }
      const data = await this.authApi.verifyForgotOtp({
        email: this.forms().forgot.account.trim(),
        otpCode,
      });
      this.resetToken.set(data?.reset_token || "");
      this.changeScreen()("reset");
    } catch (error: any) {
      this.submitError.set(error?.message || "OTP khong hop le");
    } finally {
      this.submitting.set(false);
    }
  }

  protected async handleResetSubmit() {
    this.submitting.set(true);
    this.submitError.set("");
    try {
      await this.authApi.resetPassword({
        resetToken: this.resetToken(),
        newPassword: this.forms().reset.password,
      });
      this.changeScreen()("login");
    } catch (error: any) {
      this.submitError.set(error?.message || "Khong the doi mat khau");
    } finally {
      this.submitting.set(false);
    }
  }
}

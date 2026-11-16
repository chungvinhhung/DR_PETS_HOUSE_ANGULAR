import { ChangeDetectionStrategy, Component, ElementRef, computed, input, output, signal, viewChildren } from '@angular/core';

import { PrimaryButtonComponent } from './primary-button.component';
import { CustomerIconComponent } from '../../../../shared/customer/components/icon/customer-icon.component';

/**
 * OtpForm — chuyển từ React: src/components/auth/AuthModal.jsx
 */
@Component({
  selector: 'form[app-otp-form]',
  standalone: true,
  imports: [PrimaryButtonComponent, CustomerIconComponent],
  templateUrl: './otp-form.component.html',
  styleUrl: './otp-form.component.scss',
  host: {
    'class': 'flex flex-col gap-[23.5px]',
    '(submit)': 'handle1($any($event))',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OtpFormComponent {
  // --- Input / Output (props của React) ---
  readonly changeScreen = input<any>(undefined);
  readonly nextScreen = input<any>(undefined);
  readonly previousScreen = input<any>(undefined);
  readonly onSubmitOtp = output<any>();
  readonly submitError = input<any>("");
  readonly submitting = input<any>(false);
  /** true khi component cha có truyền (onSubmitOtp) — thay cho kiểm tra "if (onSubmitOtp)" của React */
  readonly hasOnSubmitOtp = input<boolean>(false);
  /** Nút "Gửi lại mã": chỉ hoạt động khi component cha truyền (onResendOtp) + [hasOnResendOtp]="true". */
  readonly onResendOtp = output<void>();
  readonly hasOnResendOtp = input<boolean>(false);
  readonly resendDisabled = input<boolean>(false);
  readonly resendLabel = input<string>("Gửi lại mã");

  // --- Giá trị tính toán (computed) ---
  readonly complete = computed<any>(() => this.otp().join("").length === 6);

  // --- Trạng thái (signal = useState / useRef) ---
  readonly otp = signal<any>(Array(6).fill(""));
  private readonly inputs = viewChildren<ElementRef<HTMLInputElement>>('otpInput');
  get refs(): { current: any } {
    return { current: this.inputs().map((ref) => ref.nativeElement) };
  }

  protected handleResend() {
    if (this.hasOnResendOtp() && !this.resendDisabled()) this.onResendOtp.emit();
  }

  protected updateOtp(index: any, value: any) {
    const digit = value.replace(/\D/g, "").slice(-1);
    this.otp.update((current: any) => current.map((item: any, position: any) => (position === index ? digit : item)));
    if (digit) (this.refs.current as any)[index + 1]?.focus();
  }

  protected handle1(event: any) { event.preventDefault(); if (this.complete()) this.hasOnSubmitOtp() ? this.onSubmitOtp.emit(this.otp().join("")) : this.changeScreen()(this.nextScreen()); }

  protected handle2(event: any, digit: any, index: any) { if (event.key === "Backspace" && !digit) (this.refs.current as any)[index - 1]?.focus(); }
}

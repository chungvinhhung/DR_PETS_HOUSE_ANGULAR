import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PrimaryButtonComponent } from './primary-button.component';
import { CustomerIconComponent } from '../../../../shared/customer/components/icon/customer-icon.component';

/**
 * OtpFormComponent — Quản lý xác thực mã OTP đa kênh (SMS BrandName DRPETSHOUSE & Email)
 * Thiết kế giao diện chuyên nghiệp theo tone xanh navy (#1e3a8a) và vàng thương hiệu (#f59e0b)
 */
@Component({
  selector: 'form[app-otp-form]',
  standalone: true,
  imports: [CommonModule, PrimaryButtonComponent, CustomerIconComponent],
  templateUrl: './otp-form.component.html',
  styleUrl: './otp-form.component.scss',
  host: {
    class: 'flex flex-col gap-4',
    '(submit)': 'handle1($any($event))',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OtpFormComponent implements OnInit, OnDestroy {
  // --- Navigation & Core Inputs ---
  readonly changeScreen = input<any>(undefined);
  readonly nextScreen = input<any>(undefined);
  readonly previousScreen = input<any>(undefined);
  readonly onSubmitOtp = output<string>();
  readonly submitError = input<string>('');
  readonly submitting = input<boolean>(false);
  readonly hasOnSubmitOtp = input<boolean>(false);

  // --- Resend Output & Controls ---
  readonly onResendOtp = output<void>();
  readonly hasOnResendOtp = input<boolean>(false);
  readonly resendDisabled = input<boolean>(false);
  readonly resendLabel = input<string>('Gửi lại mã');
  readonly initialOtp = input<string>('');

  // --- SMS BrandName & Channel Delivery Details ---
  readonly brandName = input<string>('DRPETSHOUSE');
  readonly phone = input<string>('');
  readonly email = input<string>('');
  readonly debugOtp = input<string>('');
  readonly showBrandnamePreview = input<boolean>(true);

  // --- State Signals ---
  readonly otp = signal<string[]>(Array(6).fill(''));
  readonly copied = signal<boolean>(false);
  readonly countdown = signal<number>(60);
  readonly canResendLocal = signal<boolean>(false);

  private timerInterval: any = null;
  private readonly inputs = viewChildren<ElementRef<HTMLInputElement>>('otpInput');

  get refs(): { current: HTMLInputElement[] } {
    return { current: this.inputs().map((ref) => ref.nativeElement) };
  }

  // --- Computed Properties ---
  readonly complete = computed<boolean>(() => this.otp().join('').length === 6);

  readonly maskedPhone = computed<string>(() => {
    const raw = String(this.phone() || '').trim();
    if (!raw) return '';
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('84') && digits.length >= 11) {
      digits = '0' + digits.slice(2);
    }
    if (digits.length >= 7) {
      return `${digits.slice(0, 3)}***${digits.slice(-4)}`;
    }
    return raw;
  });

  readonly maskedEmail = computed<string>(() => {
    const raw = String(this.email() || '').trim();
    if (!raw || !raw.includes('@')) return '';
    const [name, domain] = raw.split('@');
    if (name.length <= 3) return `${name[0]}***@${domain}`;
    return `${name.slice(0, 2)}***${name.slice(-2)}@${domain}`;
  });

  readonly currentResendText = computed<string>(() => {
    if (!this.canResendLocal() && this.countdown() > 0) {
      return `Gửi lại mã (${this.countdown()}s)`;
    }
    return this.resendLabel() || 'Gửi lại mã';
  });

  constructor() {
    effect(() => {
      const init = String(this.initialOtp() || this.debugOtp() || '').trim();
      if (init.length === 6 && this.otp().join('') !== init) {
        this.otp.set(init.split(''));
      }
    });
  }

  ngOnInit(): void {
    this.startCountdown();
  }

  ngOnDestroy(): void {
    this.stopCountdown();
  }

  private startCountdown(): void {
    this.stopCountdown();
    this.countdown.set(60);
    this.canResendLocal.set(false);

    this.timerInterval = setInterval(() => {
      const current = this.countdown();
      if (current > 1) {
        this.countdown.set(current - 1);
      } else {
        this.countdown.set(0);
        this.canResendLocal.set(true);
        this.stopCountdown();
      }
    }, 1000);
  }

  private stopCountdown(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  protected handleResend(): void {
    if (this.resendDisabled()) return;
    if (this.hasOnResendOtp()) {
      this.onResendOtp.emit();
      this.startCountdown();
    }
  }

  protected updateOtp(index: number, value: string): void {
    const digit = value.replace(/\D/g, '').slice(-1);
    this.otp.update((current) => current.map((item, pos) => (pos === index ? digit : item)));
    if (digit && (this.refs.current as any)[index + 1]) {
      (this.refs.current as any)[index + 1].focus();
    }
  }

  protected handle1(event: Event): void {
    event.preventDefault();
    if (this.complete()) {
      if (this.hasOnSubmitOtp()) {
        this.onSubmitOtp.emit(this.otp().join(''));
      } else if (this.changeScreen() && this.nextScreen()) {
        this.changeScreen()(this.nextScreen());
      }
    }
  }

  protected handle2(event: KeyboardEvent, digit: string, index: number): void {
    if (event.key === 'Backspace' && !digit && (this.refs.current as any)[index - 1]) {
      (this.refs.current as any)[index - 1].focus();
    }
  }

  protected copyCode(code: string): void {
    if (!code) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(code).then(() => {
        this.copied.set(true);
        setTimeout(() => this.copied.set(false), 2000);
      });
    }
  }

  protected autoFillCode(code: string): void {
    if (!code || code.length !== 6) return;
    this.otp.set(code.split(''));
  }
}

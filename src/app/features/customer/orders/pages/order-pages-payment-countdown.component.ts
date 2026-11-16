import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked } from '@angular/core';

/**
 * OrderPagesPaymentCountdown — chuyển từ React: src/pages/Order/OrderPages.jsx (component PaymentCountdown)
 */
@Component({
  selector: 'span[app-order-pages-payment-countdown]',
  standalone: true,
  imports: [],
  templateUrl: './order-pages-payment-countdown.component.html',
  styleUrl: './order-pages-payment-countdown.component.scss',
  host: {
    '[class]': '`text-[12px] font-medium ${remainingSeconds() ? \'text-[#C62828]\' : \'text-[#667085]\'}`',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderPagesPaymentCountdownComponent {
  // --- Input / Output (props của React) ---
  readonly expiresAt = input<any>(undefined);
  readonly onExpire = output<any>();

  // --- Giá trị tính toán (computed) ---
  readonly minutes = computed<any>(() => Math.floor(this.remainingSeconds() / 60));
  readonly seconds = computed<any>(() => this.remainingSeconds() % 60);

  // --- Trạng thái (signal = useState / useRef) ---
  readonly remainingSeconds = signal<any>(this.getRemainingSeconds.bind(this));

  constructor() {
    // useEffect(..., [expiresAt, onExpire])
    effect((onCleanup: any) => {
      this.expiresAt();
      const cleanup = untracked(() => {
        const updateRemaining = () => {
          const nextRemaining = this.getRemainingSeconds();
          this.remainingSeconds.set(nextRemaining);
          if (nextRemaining === 0) this.onExpire.emit(undefined);
        };

        updateRemaining();
        const intervalId = window.setInterval(updateRemaining, 1000);
        return () => window.clearInterval(intervalId);
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });
  }

  protected getRemainingSeconds() {
    return Math.max(0, Math.floor((Number(new Date(this.expiresAt()).getTime()) - Number(Date.now())) / 1000));
  }

  /** (tự sinh) global String không dùng trực tiếp được trong template */
  protected compute1(): any {
    return `Thanh toán trong ${String(this.minutes()).padStart(2, "0")}:${String(this.seconds()).padStart(2, "0")}`;
  }
}

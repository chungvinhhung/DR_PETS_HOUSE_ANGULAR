import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * PaymentCountdown — chuyển từ React: src/pages/Booking/AppointmentHistoryPage.jsx
 */
@Component({
  selector: 'span[app-payment-countdown]',
  standalone: true,
  imports: [],
  templateUrl: './payment-countdown.component.html',
  host: {
    '[class]': '`text-xs font-semibold ${remainingSeconds() ? \'text-[#c62828]\' : \'text-[#75777f]\'}`',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentCountdownComponent {
  // --- Input / Output (props của React) ---
  readonly remainingSeconds = input<any>(undefined);

  // --- Giá trị tính toán (computed) ---
  readonly minutes = computed<any>(() => Math.floor(this.remainingSeconds() / 60));
  readonly seconds = computed<any>(() => this.remainingSeconds() % 60);

  /** (tự sinh) global String không dùng trực tiếp được trong template */
  protected compute1(): any {
    return `Thanh toán trong ${String(this.minutes()).padStart(2, "0")}:${String(this.seconds()).padStart(2, "0")}`;
  }
}

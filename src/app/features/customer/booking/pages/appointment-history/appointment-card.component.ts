import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { SmallIconComponent } from './small-icon.component';
import { PaymentCountdownComponent } from './payment-countdown.component';
import { ActionButtonComponent } from './action-button.component';
import { appointmentImages } from '../../../../../shared/customer/assets/appointment-images';
import { getAppointmentActions, getAppointmentDisplayStatus } from '../../utils/appointment-display';
import { createPaymentCountdown } from '../../../../../shared/customer/utils/payment-countdown';
import { formatMoney } from './appointment-history-page.helpers';

/**
 * AppointmentCard — chuyển từ React: src/pages/Booking/AppointmentHistoryPage.jsx
 *
 * Ghi chú chuyển đổi:
 *  - output onAction được gọi với 2 tham số -> gộp thành mảng
 */
@Component({
  selector: 'article[app-appointment-card]',
  standalone: true,
  imports: [SmallIconComponent, PaymentCountdownComponent, ActionButtonComponent],
  templateUrl: './appointment-card.component.html',
  host: {
    '[class]': '`flex w-full cursor-pointer items-center justify-between rounded-[16px] border border-[#C2C6D4] bg-white py-6 pl-7 pr-6 transition hover:border-[#1976D2] hover:shadow-md ${ active() ? \'ring-2 ring-[#90caf9]\' : \'\' } ${status().value === \'cancelled\' ? \'opacity-80\' : \'\'}`',
    '(click)': 'onSelect.emit(appointment())',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentCardComponent {
  // --- Input / Output (props của React) ---
  readonly appointment = input<any>(undefined);
  readonly active = input<any>(undefined);
  readonly onSelect = output<any>();
  readonly onAction = output<any>();
  readonly actionLoading = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly appointmentImages: any = appointmentImages;
  protected readonly formatMoney: any = formatMoney;

  // --- Giá trị tính toán (computed) ---
  readonly status = computed<any>(() => getAppointmentDisplayStatus(this.appointment()));
  readonly actions = computed<any>(() => getAppointmentActions(this.appointment()));
  readonly paymentExpired = computed<any>(() => this.status().value === "pending_payment" && this.remainingSeconds() === 0);
  readonly remainingSeconds = createPaymentCountdown(() => this.appointment().paymentExpiresAt);

}

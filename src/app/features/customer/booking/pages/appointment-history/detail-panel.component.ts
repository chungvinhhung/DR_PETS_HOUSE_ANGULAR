import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { TimelineComponent } from './timeline.component';
import { PaymentCountdownComponent } from './payment-countdown.component';
import { ActionButtonComponent } from './action-button.component';
import { appointmentImages } from '../../../../../shared/customer/assets/appointment-images';
import { getAppointmentActions, getAppointmentDisplayStatus, isClinicPayment } from '../../utils/appointment-display';
import { createPaymentCountdown } from '../../../../../shared/customer/utils/payment-countdown';
import { formatMoney, paymentMethodLabels } from './appointment-history-page.helpers';

/**
 * DetailPanel — chuyển từ React: src/pages/Booking/AppointmentHistoryPage.jsx
 *
 * Ghi chú chuyển đổi:
 *  - output onAction được gọi với 2 tham số -> gộp thành mảng
 */
@Component({
  selector: 'aside[app-detail-panel]',
  standalone: true,
  imports: [TimelineComponent, PaymentCountdownComponent, ActionButtonComponent],
  templateUrl: './detail-panel.component.html',
  styleUrl: './detail-panel.component.scss',
  host: {
    'class': 'panel-slide-in',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailPanelComponent {
  // --- Input / Output (props của React) ---
  readonly appointment = input<any>(undefined);
  readonly onClose = output<any>();
  readonly onAction = output<any>();
  readonly actionLoading = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly appointmentImages: any = appointmentImages;
  protected readonly paymentMethodLabels: any = paymentMethodLabels;
  protected readonly formatMoney: any = formatMoney;

  // --- Giá trị tính toán (computed) ---
  readonly isClinic = computed<boolean>(() => isClinicPayment(this.appointment()));
  readonly status = computed<any>(() => getAppointmentDisplayStatus(this.appointment()));
  readonly actions = computed<any>(() => getAppointmentActions(this.appointment()));
  readonly paymentExpired = computed<any>(() => !this.isClinic() && this.status().value === "pending_payment" && this.remainingSeconds() === 0);
  readonly showDeadline = computed<any>(() => (this.appointment().canCancel || this.appointment().canReschedule) &&
    this.appointment().freeChangeDaysLeft > 0 &&
    this.status().value === "confirmed");
  readonly remainingSeconds = createPaymentCountdown(() => this.isClinic() ? null : this.appointment().paymentExpiresAt);

}

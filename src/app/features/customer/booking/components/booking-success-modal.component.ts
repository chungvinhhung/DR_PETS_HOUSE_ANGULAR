import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ReactStyleDirective } from '../../../../shared/customer/directives/react-style.directive';
import { CustomerLinkDirective } from '../../../../shared/customer/directives/customer-link.directive';
import { successPanelBackground, successCheckGroup } from './booking-success-modal.helpers';

/**
 * BookingSuccessModal — chuyển từ React: src/components/booking/BookingSuccessModal.jsx
 */
@Component({
  selector: 'div[app-booking-success-modal]',
  standalone: true,
  imports: [ReactStyleDirective, CustomerLinkDirective],
  templateUrl: './booking-success-modal.component.html',
  host: {
    'class': 'fixed inset-0 z-[100] flex items-center justify-center bg-[#06105a33] p-5 backdrop-blur-md',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingSuccessModalComponent {
  readonly status = input<string>('CONFIRMED');
  readonly holdExpiresAt = input<string | null>(null);

  protected readonly successPanelBackground: any = successPanelBackground;
  protected readonly successCheckGroup: any = successCheckGroup;
  readonly confirmed = computed(() => String(this.status() || '').toUpperCase() === 'CONFIRMED');
  readonly message = computed(() => this.confirmed()
    ? 'Lịch hẹn của bạn đã được xác nhận. Xem chi tiết và theo dõi lịch hẹn tại “Lịch sử đặt lịch”.'
    : 'Lịch hẹn đã được tạo và đang chờ hoàn tất thanh toán. Vui lòng theo dõi thời gian giữ chỗ trong “Lịch sử đặt lịch”.');
}

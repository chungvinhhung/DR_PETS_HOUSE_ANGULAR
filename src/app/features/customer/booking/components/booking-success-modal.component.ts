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
  // --- Input / Output (props của React) ---
  /** Guest không có trang "Lịch sử đặt lịch" (trang đó yêu cầu đăng nhập). */
  readonly isGuest = input<boolean>(false);
  readonly status = input<string | null>(null);
  readonly holdExpiresAt = input<string | null>(null);
  readonly confirmed = computed(() => String(this.status() || '').toUpperCase() === 'CONFIRMED');
  readonly message = computed(() => this.confirmed()
    ? (this.isGuest()
      ? 'Lịch hẹn đã được xác nhận. Vui lòng liên hệ phòng khám nếu cần kiểm tra thông tin.'
      : 'Lịch hẹn đã được xác nhận. Bạn có thể theo dõi tại Lịch sử đặt lịch.')
    : (this.isGuest()
      ? 'Yêu cầu đặt lịch đã được ghi nhận và đang chờ xác nhận hoặc hoàn tất thanh toán. Vui lòng liên hệ phòng khám để theo dõi.'
      : 'Yêu cầu đặt lịch đã được ghi nhận và đang chờ xác nhận hoặc hoàn tất thanh toán. Vui lòng theo dõi tại Lịch sử đặt lịch.'));
  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly successPanelBackground: any = successPanelBackground;
  protected readonly successCheckGroup: any = successCheckGroup;

}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

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
  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly successPanelBackground: any = successPanelBackground;
  protected readonly successCheckGroup: any = successCheckGroup;

}

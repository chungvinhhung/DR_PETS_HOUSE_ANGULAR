import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { NotificationItemComponent } from './notification-item.component';
import { NOTIFICATION_FILTERS } from '../../data/notification-data';
import { notificationImages } from '../../../../shared/customer/assets/notification-images';

/**
 * NotificationPopup — chuyển từ React: src/components/Notifications/NotificationPopup.jsx
 */
@Component({
  selector: 'section[app-notification-popup]',
  standalone: true,
  imports: [NotificationItemComponent],
  templateUrl: './notification-popup.component.html',
  styleUrl: './notification-popup.component.scss',
  host: {
    'class': 'notification-popover',
    'data-node-id': '3075:10754',
    'data-name': 'thông báo',
    'role': 'dialog',
    'aria-modal': 'false',
    'aria-label': 'Thông báo',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationPopupComponent {
  // --- Input / Output (props của React) ---
  readonly readIds = input<any>(undefined);
  readonly activeFilter = input<any>(undefined);
  readonly searchValue = input<any>(undefined);
  readonly filteredItems = input<any>(undefined);
  readonly unreadCount = input<any>(undefined);
  readonly onClose = output<any>();
  readonly onFilterChange = output<any>();
  readonly onSearchChange = output<any>();
  readonly onRead = output<any>();
  readonly onReadAll = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly notificationImages: any = notificationImages;
  protected readonly NOTIFICATION_FILTERS: any = NOTIFICATION_FILTERS;

}

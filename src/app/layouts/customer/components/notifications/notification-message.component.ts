import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { messageToneClass } from './notification-popup.helpers';

/**
 * NotificationMessage — chuyển từ React: src/components/Notifications/NotificationPopup.jsx
 */
@Component({
  selector: 'p[app-notification-message]',
  standalone: true,
  imports: [],
  templateUrl: './notification-message.component.html',
  host: {
    'class': 'notification-item__message',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationMessageComponent {
  // --- Input / Output (props của React) ---
  readonly parts = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly messageToneClass: any = messageToneClass;

}

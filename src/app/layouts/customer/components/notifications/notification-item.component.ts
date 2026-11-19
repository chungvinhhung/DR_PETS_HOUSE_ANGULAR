import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { NotificationVisualComponent } from './notification-visual.component';
import { NotificationMessageComponent } from './notification-message.component';

/**
 * NotificationItem — chuyển từ React: src/components/Notifications/NotificationPopup.jsx
 */
@Component({
  selector: 'button[app-notification-item]',
  standalone: true,
  imports: [NotificationVisualComponent, NotificationMessageComponent],
  templateUrl: './notification-item.component.html',
  styleUrl: './notification-item.component.scss',
  host: {
    'type': 'button',
    '[class]': '`notification-item ${typeClass()} ${isUnread() ? \'notification-item--unread\' : \'\'}`',
    '(click)': 'onRead.emit(item().id)',
    '[attr.aria-label]': '`Thông báo: ${item().searchableText}`',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationItemComponent {
  // --- Input / Output (props của React) ---
  readonly item = input<any>(undefined);
  readonly read = input<any>(undefined);
  readonly onRead = output<any>();

  // --- Giá trị tính toán (computed) ---
  readonly isUnread = computed<any>(() => !this.read());
  readonly typeClass = computed<any>(() => this.item().id === "appointment-nau"
      ? "notification-item--appointment"
      : this.item().id === "grouped-luna"
        ? "notification-item--grouped"
        : this.item().type === "system"
          ? "notification-item--system"
          : "notification-item--pet");

}

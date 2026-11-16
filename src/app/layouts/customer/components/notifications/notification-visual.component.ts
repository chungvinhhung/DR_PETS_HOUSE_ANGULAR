import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { ReactStyleDirective } from '../../../../shared/customer/directives/react-style.directive';

/**
 * NotificationVisual — chuyển từ React: src/components/Notifications/NotificationPopup.jsx
 */
@Component({
  selector: 'app-notification-visual',
  standalone: true,
  imports: [ReactStyleDirective],
  templateUrl: './notification-visual.component.html',
  styleUrl: './notification-visual.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationVisualComponent {
  // --- Input / Output (props của React) ---
  readonly item = input<any>(undefined);

}

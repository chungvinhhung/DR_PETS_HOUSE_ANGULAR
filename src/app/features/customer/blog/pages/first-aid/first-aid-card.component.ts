import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { CustomerIconComponent } from '../../../../../shared/customer/components/icon/customer-icon.component';
import { CustomerLinkDirective } from '../../../../../shared/customer/directives/customer-link.directive';

/**
 * FirstAidCard — chuyển từ React: src/pages/Blog/FirstAidPage.jsx
 */
@Component({
  selector: 'app-first-aid-card',
  standalone: true,
  imports: [CustomerIconComponent, CustomerLinkDirective],
  templateUrl: './first-aid-card.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FirstAidCardComponent {
  // --- Input / Output (props của React) ---
  readonly post = input<any>(undefined);

  // --- Giá trị tính toán (computed) ---
  readonly isUrgent = computed<any>(() => this.post().variant === "urgent");
  readonly hasImage = computed<any>(() => Boolean(this.post().image));

}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { CustomerIconComponent } from '../../../../../shared/customer/components/icon/customer-icon.component';
import { iconByName } from './service-pricing-modal.helpers';

/**
 * ServiceIcon — chuyển từ React: src/components/groomingSpa/ServicePricingModal.jsx
 */
@Component({
  selector: 'app-service-icon',
  standalone: true,
  imports: [CustomerIconComponent],
  templateUrl: './service-icon.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceIconComponent {
  // --- Input / Output (props của React) ---
  readonly name = input<any>(undefined);
  readonly color = input<any>(undefined);

  // --- Giá trị tính toán (computed) ---
  readonly Icon = computed<any>(() => (iconByName as any)[this.name()] || 'sparkles');

}

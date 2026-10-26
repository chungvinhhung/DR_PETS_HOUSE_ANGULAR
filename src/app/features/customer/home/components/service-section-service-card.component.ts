import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { CustomerLinkDirective } from '../../../../shared/customer/directives/customer-link.directive';

/**
 * ServiceSectionServiceCard — chuyển từ React: src/components/home/ServiceSection.jsx (component ServiceCard)
 */
@Component({
  selector: 'article[app-service-section-service-card]',
  standalone: true,
  imports: [CustomerLinkDirective],
  templateUrl: './service-section-service-card.component.html',
  host: {
    'class': 'group flex flex-1 flex-col items-center transition-transform duration-component ease-premium hover:-translate-y-1',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceSectionServiceCardComponent {
  // --- Input / Output (props của React) ---
  readonly image = input<any>(undefined);
  readonly title = input<any>(undefined);
  readonly description = input<any>(undefined);
  readonly href = input<any>(undefined);

}

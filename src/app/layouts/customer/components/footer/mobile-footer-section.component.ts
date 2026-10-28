import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { CustomerIconComponent } from '../../../../shared/customer/components/icon/customer-icon.component';
import { CustomerLinkDirective } from '../../../../shared/customer/directives/customer-link.directive';

/**
 * MobileFooterSection — chuyển từ React: src/components/Footer/Footer.jsx
 */
@Component({
  selector: 'section[app-mobile-footer-section]',
  standalone: true,
  imports: [CustomerIconComponent, CustomerLinkDirective],
  templateUrl: './mobile-footer-section.component.html',
  host: {
    'class': 'border-b-[0.5px] border-[#0D47A1]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileFooterSectionComponent {
  // --- Input / Output (props của React) ---
  readonly title = input<any>(undefined);
  readonly links = input<any>(undefined);
  readonly open = input<any>(undefined);
  readonly onToggle = output<any>();
  readonly onPricingOpen = output<any>();

}

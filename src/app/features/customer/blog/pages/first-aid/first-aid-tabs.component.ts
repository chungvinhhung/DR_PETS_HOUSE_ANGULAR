import { ChangeDetectionStrategy, Component } from '@angular/core';

import { CustomerLinkDirective } from '../../../../../shared/customer/directives/customer-link.directive';

/**
 * FirstAidTabs — chuyển từ React: src/pages/Blog/FirstAidPage.jsx
 */
@Component({
  selector: 'nav[app-first-aid-tabs]',
  standalone: true,
  imports: [CustomerLinkDirective],
  templateUrl: './first-aid-tabs.component.html',
  host: {
    'class': 'flex h-14 w-full max-w-[1200px] items-center gap-6 overflow-x-auto whitespace-nowrap text-[16px] sm:gap-10',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FirstAidTabsComponent {
}

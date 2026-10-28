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
    'class': 'flex h-14 w-[1200px] items-center gap-10 text-[16px]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FirstAidTabsComponent {
}

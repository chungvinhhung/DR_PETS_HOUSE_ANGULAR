import { ChangeDetectionStrategy, Component } from '@angular/core';

import { CustomerIconComponent } from '../../../../../shared/customer/components/icon/customer-icon.component';
import { CustomerLinkDirective } from '../../../../../shared/customer/directives/customer-link.directive';

/**
 * EmergencySupport — chuyển từ React: src/pages/Blog/FirstAidDetailPage.jsx
 */
@Component({
  selector: 'aside[app-emergency-support]',
  standalone: true,
  imports: [CustomerIconComponent, CustomerLinkDirective],
  templateUrl: './emergency-support.component.html',
  host: {
    'class': 'relative flex h-[364px] w-[373px] shrink-0 flex-col justify-center gap-6 rounded-[32px] border-l-4 border-[#C62828] bg-white px-10 shadow-md',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmergencySupportComponent {
}

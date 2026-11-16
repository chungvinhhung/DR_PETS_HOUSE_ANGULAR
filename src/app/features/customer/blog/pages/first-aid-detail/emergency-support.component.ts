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
  styleUrl: './emergency-support.component.scss',
  host: {
    'class': 'relative flex min-h-[364px] w-full flex-col justify-center gap-6 rounded-[32px] border-l-4 border-[#C62828] bg-white px-6 py-8 shadow-md sm:px-10 lg:h-[364px] lg:py-0',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmergencySupportComponent {
}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { CustomerLinkDirective } from '../../../../shared/customer/directives/customer-link.directive';
import { policyImages } from '../../../../shared/customer/assets/policy-images';

/**
 * PolicySupportCta — chuyển từ React: src/pages/Policy/PolicyPage.jsx
 */
@Component({
  selector: 'section[app-policy-support-cta]',
  standalone: true,
  imports: [CustomerLinkDirective],
  templateUrl: './policy-support-cta.component.html',
  styleUrl: './policy-support-cta.component.scss',
  host: {
    'class': 'flex w-full flex-col items-start gap-6 rounded-[8px] bg-white p-6 sm:flex-row sm:items-start sm:justify-between lg:h-[158px] lg:w-[813px] lg:justify-start lg:gap-0 lg:p-0',
    'data-node-id': '3102:11381',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PolicySupportCtaComponent {
  // --- Input / Output (props của React) ---
  readonly policy = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly policyImages: any = policyImages;

}

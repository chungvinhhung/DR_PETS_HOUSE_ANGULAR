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
  host: {
    'class': 'flex h-[158px] w-[813px] items-start rounded-[8px] bg-white',
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

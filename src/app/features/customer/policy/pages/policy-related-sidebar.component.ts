import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { CustomerLinkDirective } from '../../../../shared/customer/directives/customer-link.directive';
import { getRelatedPolicies } from '../data/policy-data';

/**
 * PolicyRelatedSidebar — chuyển từ React: src/pages/Policy/PolicyPage.jsx
 */
@Component({
  selector: 'aside[app-policy-related-sidebar]',
  standalone: true,
  imports: [CustomerLinkDirective],
  templateUrl: './policy-related-sidebar.component.html',
  styleUrl: './policy-related-sidebar.component.scss',
  host: {
    'class': 'w-full shrink-0 rounded-[12px] bg-white px-6 pb-6 pt-6 lg:h-[630px] lg:w-[330px] lg:pb-0',
    'data-node-id': '3102:10766',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PolicyRelatedSidebarComponent {
  // --- Input / Output (props của React) ---
  readonly activeSlug = input<any>(undefined);

  // --- Giá trị tính toán (computed) ---
  readonly relatedPolicies = computed<any>(() => getRelatedPolicies(this.activeSlug()));

}

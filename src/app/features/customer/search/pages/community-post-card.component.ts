import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { CustomerIconComponent } from '../../../../shared/customer/components/icon/customer-icon.component';

/**
 * CommunityPostCard — chuyển từ React: src/pages/Search/SearchResultsPage.jsx
 */
@Component({
  selector: 'article[app-community-post-card]',
  standalone: true,
  imports: [CustomerIconComponent],
  templateUrl: './community-post-card.component.html',
  host: {
    'class': 'w-full rounded-[24px] border border-[#EEE] bg-white p-[25px] shadow-[0_1px_1px_rgba(0,0,0,0.05)]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunityPostCardComponent {
  // --- Input / Output (props của React) ---
  readonly post = input<any>(undefined);

}

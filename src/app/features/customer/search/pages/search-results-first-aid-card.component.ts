import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { CustomerLinkDirective } from '../../../../shared/customer/directives/customer-link.directive';

/**
 * SearchResultsFirstAidCard — chuyển từ React: src/pages/Search/SearchResultsPage.jsx (component FirstAidCard)
 */
@Component({
  selector: 'article[app-search-results-first-aid-card]',
  standalone: true,
  imports: [CustomerLinkDirective],
  templateUrl: './search-results-first-aid-card.component.html',
  host: {
    'class': 'flex h-[438px] w-[441px] flex-col rounded-[24px] bg-white p-[41px] shadow-[0_1px_2px_rgba(0,0,0,0.05)]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchResultsFirstAidCardComponent {
  // --- Input / Output (props của React) ---
  readonly post = input<any>(undefined);
  readonly featured = input<any>(false);

}

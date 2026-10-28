import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { CustomerLinkDirective } from '../../../../shared/customer/directives/customer-link.directive';

/**
 * EmptyResultsContent — chuyển từ React: src/pages/Search/SearchResultsPage.jsx
 */
@Component({
  selector: 'section[app-empty-results-content]',
  standalone: true,
  imports: [CustomerLinkDirective],
  templateUrl: './empty-results-content.component.html',
  host: {
    'class': 'flex w-full flex-col items-center justify-center px-4 pb-20 pt-12 text-center',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyResultsContentComponent {
  // --- Input / Output (props của React) ---
  readonly emptyState = input<any>(undefined);
  readonly onRetry = output<any>();

}

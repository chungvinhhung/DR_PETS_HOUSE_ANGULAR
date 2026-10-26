import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { SearchResultsSectionHeadingComponent } from './search-results-section-heading.component';
import { ProductsGridComponent } from './products-grid.component';
import { CustomerLinkDirective } from '../../../../shared/customer/directives/customer-link.directive';

/**
 * ProductsSection — chuyển từ React: src/pages/Search/SearchResultsPage.jsx
 */
@Component({
  selector: 'section[app-products-section]',
  standalone: true,
  imports: [SearchResultsSectionHeadingComponent, ProductsGridComponent, CustomerLinkDirective],
  templateUrl: './products-section.component.html',
  host: {
    'class': 'flex w-full flex-col gap-8',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsSectionComponent {
  // --- Input / Output (props của React) ---
  readonly results = input<any>(undefined);
  readonly allMode = input<any>(false);

}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { ShoppingProductCardComponent } from '../../../../shared/customer/components/shopping-product-card/shopping-product-card.component';

/**
 * ProductsGrid — chuyển từ React: src/pages/Search/SearchResultsPage.jsx
 */
@Component({
  selector: 'div[app-products-grid]',
  standalone: true,
  imports: [ShoppingProductCardComponent],
  templateUrl: './products-grid.component.html',
  styleUrl: './products-grid.component.scss',
  host: {
    'class': 'grid w-full grid-cols-2 justify-items-center gap-x-[10.75px] gap-y-8 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsGridComponent {
  // --- Input / Output (props của React) ---
  readonly products = input<any>(undefined);

}

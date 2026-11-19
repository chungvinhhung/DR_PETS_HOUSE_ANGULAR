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
    'class': 'grid w-full grid-cols-[repeat(auto-fill,minmax(max(170px,calc((100%_-_64px)/5)),1fr))] justify-items-center gap-x-4 gap-y-8',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsGridComponent {
  // --- Input / Output (props của React) ---
  readonly products = input<any>(undefined);

}

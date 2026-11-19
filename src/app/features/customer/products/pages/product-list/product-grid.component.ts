import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { ShoppingProductCardComponent } from '../../../../../shared/customer/components/shopping-product-card/shopping-product-card.component';

/**
 * ProductGrid — chuyển từ React: src/pages/Product/ProductPage.jsx
 */
@Component({
  selector: 'app-product-grid',
  standalone: true,
  imports: [ShoppingProductCardComponent],
  templateUrl: './product-grid.component.html',
  styleUrl: './product-grid.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductGridComponent {
  // --- Input / Output (props của React) ---
  readonly products = input<any>(undefined);

}

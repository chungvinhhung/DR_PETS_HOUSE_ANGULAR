import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { FilterHeadingComponent } from './filter-heading.component';
import { PRODUCT_PRICE_RANGES as PRICE_RANGES } from '../../../../../shared/customer/data/shop-data';

/**
 * FilterSidebar — chuyển từ React: src/pages/Product/ProductPage.jsx
 */
@Component({
  selector: 'aside[app-filter-sidebar]',
  standalone: true,
  imports: [FilterHeadingComponent],
  templateUrl: './filter-sidebar.component.html',
  styleUrl: './filter-sidebar.component.scss',
  host: {
    'class': 'w-full shrink-0 lg:w-[283px] lg:pt-[75px]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterSidebarComponent {
  // --- Input / Output (props của React) ---
  readonly categoryOptions = input<any>(undefined);
  readonly selectedCategories = input<any>(undefined);
  readonly selectedPrices = input<any>(undefined);
  readonly onCategoryChange = output<any>();
  readonly onPriceChange = output<any>();
  readonly onClear = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly PRICE_RANGES: any = PRICE_RANGES;

}

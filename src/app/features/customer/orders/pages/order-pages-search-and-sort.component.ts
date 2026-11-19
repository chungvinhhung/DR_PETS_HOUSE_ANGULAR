import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { SelectValueDirective } from '../../../../shared/customer/directives/select-value.directive';
import { productImages } from '../../../../shared/customer/assets/product-images';

/**
 * OrderPagesSearchAndSort — chuyển từ React: src/pages/Order/OrderPages.jsx (component SearchAndSort)
 */
@Component({
  selector: 'form[app-order-pages-search-and-sort]',
  standalone: true,
  imports: [SelectValueDirective],
  templateUrl: './order-pages-search-and-sort.component.html',
  styleUrl: './order-pages-search-and-sort.component.scss',
  host: {
    'class': 'flex gap-[10px]',
    '(submit)': 'handle1($any($event))',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderPagesSearchAndSortComponent {
  // --- Input / Output (props của React) ---
  readonly searchInput = input<any>(undefined);
  readonly onSearchInputChange = output<any>();
  readonly onSearch = output<void>();
  readonly sortOrder = input<any>(undefined);
  readonly onSortChange = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly productImages: any = productImages;

  protected handle1(event: any) {
    event.preventDefault();
    this.onSearch.emit();
  }
}

import { ChangeDetectionStrategy, Component, ElementRef, input, output, viewChild } from '@angular/core';

import { SelectValueDirective } from '../../../../../shared/customer/directives/select-value.directive';
import { productImages } from '../../../../../shared/customer/assets/product-images';

/**
 * ProductSearchAndSort — chuyển từ React: src/pages/Product/ProductPage.jsx (component SearchAndSort)
 */
@Component({
  selector: 'form[app-product-search-and-sort]',
  standalone: true,
  imports: [SelectValueDirective],
  templateUrl: './product-search-and-sort.component.html',
  styleUrl: './product-search-and-sort.component.scss',
  host: {
    'class': 'flex w-full gap-[10px]',
    '(submit)': 'handle1($any($event))',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductSearchAndSortComponent {
  // --- Input / Output (props của React) ---
  readonly search = input<any>(undefined);
  readonly onSearchChange = output<any>();
  readonly onSearch = output<void>();
  readonly onClearSearch = output<void>();
  readonly sortOrder = input<any>(undefined);
  readonly onSortChange = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly productImages: any = productImages;

  // --- Trạng thái (signal = useState / useRef) ---
  readonly inputRef = viewChild<ElementRef<any>>('inputRef');

  protected selectSearchText() {
    if (this.search()) {
      window.requestAnimationFrame(() => this.inputRef()?.nativeElement?.select());
    }
  }

  protected handle1(event: any) {
    event.preventDefault();
    this.onSearch.emit();
  }

  protected handle2() {
    this.onClearSearch.emit();
    this.inputRef()?.nativeElement?.focus();
  }
}

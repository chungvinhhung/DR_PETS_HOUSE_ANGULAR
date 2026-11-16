import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { SearchSuggestionStatusComponent } from './search-suggestion-status.component';
import { TextSuggestionItemComponent } from './text-suggestion-item.component';
import { ProductSuggestionCardComponent } from './product-suggestion-card.component';
import { searchSuggestionImages } from '../../../../shared/customer/assets/search-suggestion-images';

/**
 * SearchSuggestionDropdown — chuyển từ React: src/components/Navbar/SearchSuggestionDropdown.jsx
 */
@Component({
  selector: 'app-search-suggestion-dropdown',
  standalone: true,
  imports: [SearchSuggestionStatusComponent, TextSuggestionItemComponent, ProductSuggestionCardComponent],
  templateUrl: './search-suggestion-dropdown.component.html',
  styleUrl: './search-suggestion-dropdown.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchSuggestionDropdownComponent {
  // --- Input / Output (props của React) ---
  readonly query = input<any>(undefined);
  readonly suggestions = input<any>(undefined);
  readonly products = input<any>(undefined);
  readonly isLoading = input<any>(false);
  readonly error = input<any>("");
  readonly activeItemId = input<any>(undefined);
  readonly onClose = output<any>();
  readonly onSuggestionSelect = output<any>();
  readonly onProductSelect = output<any>();
  readonly onSeeAll = output<any>();
  readonly onItemHover = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly searchSuggestionImages: any = searchSuggestionImages;

  // --- Giá trị tính toán (computed) ---
  readonly hasResults = computed<any>(() => this.suggestions().length > 0 || this.products().length > 0);
  readonly shouldUseFigmaListHeight = computed<any>(() => !this.isLoading() && !this.error() && this.suggestions().length >= 4);

}

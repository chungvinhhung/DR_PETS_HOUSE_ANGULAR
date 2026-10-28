import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { HighlightedTextComponent } from './highlighted-text.component';
import { searchSuggestionImages } from '../../../../shared/customer/assets/search-suggestion-images';
import { formatVnd } from '../../../../shared/customer/utils/currency';

/**
 * ProductSuggestionCard — chuyển từ React: src/components/Navbar/SearchSuggestionDropdown.jsx
 */
@Component({
  selector: 'button[app-product-suggestion-card]',
  standalone: true,
  imports: [HighlightedTextComponent],
  templateUrl: './product-suggestion-card.component.html',
  host: {
    'type': 'button',
    '(click)': 'onSelect.emit(product())',
    '(mouseenter)': 'onHover.emit($event)',
    '[class]': '[ \'flex min-w-0 flex-1 items-center gap-3 rounded-[8px] p-2 text-left transition-colors\', active() ? \'bg-[#FFF59D]\' : \'bg-[#FFF9C4] hover:bg-[#FFF59D]\' ].join(\' \')',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductSuggestionCardComponent {
  // --- Input / Output (props của React) ---
  readonly product = input<any>(undefined);
  readonly query = input<any>(undefined);
  readonly active = input<any>(false);
  readonly onSelect = output<any>();
  readonly onHover = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly searchSuggestionImages: any = searchSuggestionImages;
  protected readonly formatVnd: any = formatVnd;

}

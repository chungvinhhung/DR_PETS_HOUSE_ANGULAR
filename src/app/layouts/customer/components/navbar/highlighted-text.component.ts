import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { highlightKeywordParts } from '../../../../shared/customer/utils/search-suggestion.utils';

/**
 * HighlightedText — chuyển từ React: src/components/Navbar/SearchSuggestionDropdown.jsx
 */
@Component({
  selector: 'app-highlighted-text',
  standalone: true,
  imports: [],
  templateUrl: './highlighted-text.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HighlightedTextComponent {
  // --- Input / Output (props của React) ---
  readonly text = input<any>(undefined);
  readonly keyword = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly highlightKeywordParts: any = highlightKeywordParts;

}

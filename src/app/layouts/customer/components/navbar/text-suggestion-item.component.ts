import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { HighlightedTextComponent } from './highlighted-text.component';
import { searchSuggestionImages } from '../../../../shared/customer/assets/search-suggestion-images';

/**
 * TextSuggestionItem — chuyển từ React: src/components/Navbar/SearchSuggestionDropdown.jsx
 */
@Component({
  selector: 'button[app-text-suggestion-item]',
  standalone: true,
  imports: [HighlightedTextComponent],
  templateUrl: './text-suggestion-item.component.html',
  styleUrl: './text-suggestion-item.component.scss',
  host: {
    'type': 'button',
    '(click)': 'onSelect.emit(suggestion())',
    '(mouseenter)': 'onHover.emit($event)',
    '[class]': '[ \'flex w-full items-center gap-3 rounded-[8px] border-b border-[#E0E0E0] p-2 text-left transition-colors\', active() ? \'bg-[#FFF59D]\' : \'hover:bg-[#FFF9C4]\' ].join(\' \')',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextSuggestionItemComponent {
  // --- Input / Output (props của React) ---
  readonly suggestion = input<any>(undefined);
  readonly query = input<any>(undefined);
  readonly active = input<any>(false);
  readonly onSelect = output<any>();
  readonly onHover = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly searchSuggestionImages: any = searchSuggestionImages;

}

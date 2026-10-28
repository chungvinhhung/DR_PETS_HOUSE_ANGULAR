import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * SearchSuggestionStatus — chuyển từ React: src/components/Navbar/SearchSuggestionDropdown.jsx
 */
@Component({
  selector: 'div[app-search-suggestion-status]',
  standalone: true,
  imports: [],
  templateUrl: './search-suggestion-status.component.html',
  host: {
    'class': 'flex min-h-[64px] w-full items-center justify-center rounded-[8px] border-b border-[#E0E0E0] px-4 text-center font-[\'Roboto\'] text-[14px] leading-6 text-black/60',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchSuggestionStatusComponent {
}

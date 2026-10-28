import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * SortButton — chuyển từ React: src/pages/Search/SearchResultsPage.jsx
 */
@Component({
  selector: 'button[app-sort-button]',
  standalone: true,
  imports: [],
  templateUrl: './sort-button.component.html',
  host: {
    'type': 'button',
    '(click)': 'onClick.emit($event)',
    '[class]': '[ \'h-[42px] rounded-full border px-[17px] text-[16px] font-semibold leading-6 shadow-[0_1px_1px_rgba(0,0,0,0.05)] transition-colors\', active() ? \'border-[#0D47A1] bg-[#0D47A1] text-white\' : \'border-[#C2C6D4] bg-white text-black/60 hover:border-[#0D47A1] hover:text-[#0D47A1]\' ].join(\' \')',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SortButtonComponent {
  // --- Input / Output (props của React) ---
  readonly option = input<any>(undefined);
  readonly active = input<any>(undefined);
  readonly onClick = output<any>();

}

import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { SortButtonComponent } from './sort-button.component';
import { SORT_OPTIONS } from './search-results-page.helpers';

/**
 * ResultsHeader — chuyển từ React: src/pages/Search/SearchResultsPage.jsx
 */
@Component({
  selector: 'header[app-results-header]',
  standalone: true,
  imports: [SortButtonComponent],
  templateUrl: './results-header.component.html',
  host: {
    'class': 'flex w-full flex-col items-start gap-2',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResultsHeaderComponent {
  // --- Input / Output (props của React) ---
  readonly query = input<any>(undefined);
  readonly activeType = input<any>(undefined);
  readonly activeSort = input<any>(undefined);
  readonly counts = input<any>(undefined);
  readonly total = input<any>(undefined);
  readonly emptyState = input<any>(undefined);
  readonly onSortChange = output<any>();
  readonly isEmpty = input<any>(false);

  // --- Giá trị tính toán (computed) ---
  readonly sortOptions = computed<any>(() => SORT_OPTIONS.filter((option: any) => option.appliesTo.includes(this.activeType())));

}

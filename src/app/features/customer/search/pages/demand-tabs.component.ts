import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { SEARCH_DEMAND_TYPES } from '../../../../shared/customer/data/search-results-data';

/**
 * DemandTabs — chuyển từ React: src/pages/Search/SearchResultsPage.jsx
 */
@Component({
  selector: 'div[app-demand-tabs]',
  standalone: true,
  imports: [],
  templateUrl: './demand-tabs.component.html',
  styleUrl: './demand-tabs.component.scss',
  host: {
    'class': 'flex w-full items-start justify-center gap-1 rounded-full bg-[rgba(25,118,210,0.08)] p-1',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DemandTabsComponent {
  // --- Input / Output (props của React) ---
  readonly activeType = input<any>(undefined);
  readonly onChange = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly SEARCH_DEMAND_TYPES: any = SEARCH_DEMAND_TYPES;

}

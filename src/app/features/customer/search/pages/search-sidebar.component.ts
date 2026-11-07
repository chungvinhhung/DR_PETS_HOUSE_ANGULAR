import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { DemandTabsComponent } from './demand-tabs.component';
import { FilterGroupComponent } from './filter-group.component';
import { CustomerIconComponent } from '../../../../shared/customer/components/icon/customer-icon.component';

/**
 * SearchSidebar — chuyển từ React: src/pages/Search/SearchResultsPage.jsx
 */
@Component({
  selector: 'aside[app-search-sidebar]',
  standalone: true,
  imports: [DemandTabsComponent, FilterGroupComponent, CustomerIconComponent],
  templateUrl: './search-sidebar.component.html',
  host: {
    'class': 'w-full shrink-0 lg:w-[283px]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchSidebarComponent {
  // --- Input / Output (props của React) ---
  readonly activeType = input<any>(undefined);
  readonly facets = input<any>(undefined);
  readonly selectedFilters = input<any>(undefined);
  readonly onFilterToggle = output<any>();
  readonly onClear = output<any>();
  readonly onTypeChange = output<any>();

  // --- Giá trị tính toán (computed) ---
  readonly groups = computed<any>(() => this.facets().filter((group: any) => group.appliesTo.includes(this.activeType())));

}

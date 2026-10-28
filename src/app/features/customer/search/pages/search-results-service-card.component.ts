import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { CustomerLinkDirective } from '../../../../shared/customer/directives/customer-link.directive';
import { formatServicePrice, parseServicePrice } from './search-results-page.helpers';

/**
 * SearchResultsServiceCard — chuyển từ React: src/pages/Search/SearchResultsPage.jsx (component ServiceCard)
 */
@Component({
  selector: 'article[app-search-results-service-card]',
  standalone: true,
  imports: [CustomerLinkDirective],
  templateUrl: './search-results-service-card.component.html',
  host: {
    'class': 'flex h-[192px] w-full overflow-hidden rounded-[48px] border border-[rgba(127,118,98,0.1)] bg-white p-px shadow-[0_1px_2px_rgba(0,0,0,0.05)]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchResultsServiceCardComponent {
  // --- Input / Output (props của React) ---
  readonly service = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly formatServicePrice: any = formatServicePrice;
  protected readonly parseServicePrice: any = parseServicePrice;

  // --- Giá trị tính toán (computed) ---
  readonly steps = computed<any>(() => this.service().steps || (this.service().title.toLowerCase().includes("combo") ? [
    "Kiểm tra lông, da",
    "Cạo lông bàn chân",
    "Cạo lông bụng",
  ] : null));

}

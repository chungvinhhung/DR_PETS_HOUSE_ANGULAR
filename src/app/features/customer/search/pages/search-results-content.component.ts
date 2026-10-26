import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { ServicesSectionComponent } from './services-section.component';
import { ProductsSectionComponent } from './products-section.component';
import { ArticlesSectionComponent } from './articles-section.component';

/**
 * SearchResultsContent — chuyển từ React: src/pages/Search/SearchResultsPage.jsx
 */
@Component({
  selector: 'app-search-results-content',
  standalone: true,
  imports: [ServicesSectionComponent, ProductsSectionComponent, ArticlesSectionComponent],
  templateUrl: './search-results-content.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchResultsContentComponent {
  // --- Input / Output (props của React) ---
  readonly activeType = input<any>(undefined);
  readonly results = input<any>(undefined);

}

import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * SearchResultsSectionHeading — chuyển từ React: src/pages/Search/SearchResultsPage.jsx (component SectionHeading)
 */
@Component({
  selector: 'div[app-search-results-section-heading]',
  standalone: true,
  imports: [],
  templateUrl: './search-results-section-heading.component.html',
  host: {
    'class': 'flex w-full items-center gap-4',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchResultsSectionHeadingComponent {
}

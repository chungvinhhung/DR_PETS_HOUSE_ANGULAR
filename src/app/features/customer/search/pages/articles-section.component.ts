import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { SearchResultsSectionHeadingComponent } from './search-results-section-heading.component';
import { SearchResultsFirstAidCardComponent } from './search-results-first-aid-card.component';
import { BlogCardComponent } from '../../../../shared/customer/components/blog-card/blog-card.component';
import { CommunityPostCardComponent } from './community-post-card.component';

/**
 * ArticlesSection — chuyển từ React: src/pages/Search/SearchResultsPage.jsx
 */
@Component({
  selector: 'section[app-articles-section]',
  standalone: true,
  imports: [SearchResultsSectionHeadingComponent, SearchResultsFirstAidCardComponent, BlogCardComponent, CommunityPostCardComponent],
  templateUrl: './articles-section.component.html',
  host: {
    'class': 'flex w-full flex-col gap-8',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticlesSectionComponent {
  // --- Input / Output (props của React) ---
  readonly results = input<any>(undefined);
  readonly allMode = input<any>(false);

}

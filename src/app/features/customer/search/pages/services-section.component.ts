import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { SearchResultsSectionHeadingComponent } from './search-results-section-heading.component';
import { SearchResultsServiceCardComponent } from './search-results-service-card.component';
import { CustomerLinkDirective } from '../../../../shared/customer/directives/customer-link.directive';

/**
 * ServicesSection — chuyển từ React: src/pages/Search/SearchResultsPage.jsx
 */
@Component({
  selector: 'section[app-services-section]',
  standalone: true,
  imports: [SearchResultsSectionHeadingComponent, SearchResultsServiceCardComponent, CustomerLinkDirective],
  templateUrl: './services-section.component.html',
  styleUrl: './services-section.component.scss',
  host: {
    'class': 'flex w-full flex-col gap-8',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesSectionComponent {
  // --- Input / Output (props của React) ---
  readonly results = input<any>(undefined);
  readonly allMode = input<any>(false);

}

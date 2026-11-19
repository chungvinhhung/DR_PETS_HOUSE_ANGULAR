import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { CustomerIconComponent } from '../icon/customer-icon.component';
import { ReactStyleDirective } from '../../directives/react-style.directive';

/**
 * RatingStar — chuyển từ React: src/components/product/ProductRating.jsx
 */
@Component({
  selector: 'app-rating-star',
  standalone: true,
  imports: [CustomerIconComponent, ReactStyleDirective],
  templateUrl: './rating-star.component.html',
  styleUrl: './rating-star.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RatingStarComponent {
  // --- Input / Output (props của React) ---
  readonly fillPercent = input<any>(undefined);
  readonly size = input<any>(undefined);
  readonly fillColor = input<any>(undefined);
  readonly emptyColor = input<any>(undefined);

}

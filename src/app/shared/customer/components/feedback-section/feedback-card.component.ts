import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { ProductRatingComponent } from '../product-rating/product-rating.component';
import { ReactStyleDirective } from '../../directives/react-style.directive';
import { FEEDBACK_QUOTE_HEIGHT, FEEDBACK_AUTHOR_HEIGHT } from './feedback-section.helpers';

/**
 * FeedbackCard — chuyển từ React: src/components/shop/FeedbackSection.jsx
 */
@Component({
  selector: 'article[app-feedback-card]',
  standalone: true,
  imports: [ProductRatingComponent, ReactStyleDirective],
  templateUrl: './feedback-card.component.html',
  host: {
    'class': 'flex h-[280px] min-h-[280px] w-full min-w-0 flex-col rounded-3xl bg-white p-10 transition-[transform,box-shadow] duration-component ease-premium hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedbackCardComponent {
  // --- Input / Output (props của React) ---
  readonly review = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly FEEDBACK_QUOTE_HEIGHT: any = FEEDBACK_QUOTE_HEIGHT;
  protected readonly FEEDBACK_AUTHOR_HEIGHT: any = FEEDBACK_AUTHOR_HEIGHT;

}

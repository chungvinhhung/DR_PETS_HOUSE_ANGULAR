import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { ProductRatingComponent } from '../../../../../shared/customer/components/product-rating/product-rating.component';
import { ReactStyleDirective } from '../../../../../shared/customer/directives/react-style.directive';
import { groomingImages } from '../../../../../shared/customer/assets/grooming-images';

/**
 * ReviewCard — chuyển từ React: src/components/groomingSpa/GroomingFeedback.jsx
 */
@Component({
  selector: 'article[app-review-card]',
  standalone: true,
  imports: [ProductRatingComponent, ReactStyleDirective],
  templateUrl: './review-card.component.html',
  styleUrl: './review-card.component.scss',
  host: {
    'class': 'flex flex-[1_0_0] flex-col justify-center gap-[10px] rounded-[24px] bg-white p-10',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewCardComponent {
  // --- Input / Output (props của React) ---
  readonly review = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly groomingImages: any = groomingImages;

}

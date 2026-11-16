import { ChangeDetectionStrategy, Component } from '@angular/core';

import { ReviewCardComponent } from './review-card.component';
import { ReactStyleDirective } from '../../../../../shared/customer/directives/react-style.directive';
import { groomingImages } from '../../../../../shared/customer/assets/grooming-images';
import { GROOMING_REVIEWS } from '../../../../../shared/customer/data/grooming-data';
import { groomingTitleStyles } from '../../utils/grooming-title-styles';

/**
 * GroomingFeedback — chuyển từ React: src/components/groomingSpa/GroomingFeedback.jsx
 */
@Component({
  selector: 'section[app-grooming-feedback]',
  standalone: true,
  imports: [ReviewCardComponent, ReactStyleDirective],
  templateUrl: './grooming-feedback.component.html',
  styleUrl: './grooming-feedback.component.scss',
  host: {
    'class': 'relative flex h-[683px] w-full items-center justify-center overflow-hidden px-[120px]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroomingFeedbackComponent {
  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly groomingImages: any = groomingImages;
  protected readonly groomingTitleStyles: any = groomingTitleStyles;
  protected readonly GROOMING_REVIEWS: any = GROOMING_REVIEWS;

}

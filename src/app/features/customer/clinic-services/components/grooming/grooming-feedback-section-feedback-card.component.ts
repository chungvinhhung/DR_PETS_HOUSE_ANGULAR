import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { ProductRatingComponent } from '../../../../../shared/customer/components/product-rating/product-rating.component';
import { ReactStyleDirective } from '../../../../../shared/customer/directives/react-style.directive';
import { FEEDBACK_QUOTE_HEIGHT, FEEDBACK_AUTHOR_HEIGHT } from './grooming-feedback-section.helpers';

/**
 * GroomingFeedbackSectionFeedbackCard — chuyển từ React: src/components/groomingSpa/GroomingFeedbackSection.jsx (component FeedbackCard)
 */
@Component({
  selector: 'article[app-grooming-feedback-section-feedback-card]',
  standalone: true,
  imports: [ProductRatingComponent, ReactStyleDirective],
  templateUrl: './grooming-feedback-section-feedback-card.component.html',
  styleUrl: './grooming-feedback-section-feedback-card.component.scss',
  host: {
    'class': 'flex h-[280px] min-h-[280px] w-full min-w-0 flex-col rounded-3xl bg-white p-10 transition-[transform,box-shadow] duration-component ease-premium hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroomingFeedbackSectionFeedbackCardComponent {
  // --- Input / Output (props của React) ---
  readonly review = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly FEEDBACK_QUOTE_HEIGHT: any = FEEDBACK_QUOTE_HEIGHT;
  protected readonly FEEDBACK_AUTHOR_HEIGHT: any = FEEDBACK_AUTHOR_HEIGHT;

  // --- Hàm quy đổi thời gian sang: phút, giờ, ngày, tháng, năm ---
  protected formatTimeAgo(value: number | string | Date | undefined): string {
    if (value === undefined || value === null || value === '') return '';

    let totalMinutes = 0;

    if (typeof value === 'number') {
      totalMinutes = value;
    } else if (value instanceof Date) {
      totalMinutes = Math.floor((Date.now() - value.getTime()) / 60000);
    } else if (typeof value === 'string') {
      const parsedDate = Date.parse(value);
      if (!isNaN(parsedDate) && (value.includes('-') || value.includes('/'))) {
        totalMinutes = Math.floor((Date.now() - parsedDate) / 60000);
      } else {
        const numericStr = value.replace(/\D/g, '');
        totalMinutes = numericStr ? parseInt(numericStr, 10) : 0;
      }
    }

    if (totalMinutes < 1) return 'Vừa xong';
    if (totalMinutes < 60) return `${totalMinutes} phút trước`;

    const hours = Math.floor(totalMinutes / 60);
    if (hours < 24) return `${hours} giờ trước`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} ngày trước`;

    const months = Math.floor(days / 30);
    if (months < 12) return `${months} tháng trước`;

    const years = Math.floor(days / 365);
    return `${years} năm trước`;
  }

  // Alias dự phòng nếu template gọi formatReviewTime
  protected formatReviewTime(value: number | string | Date | undefined): string {
    return this.formatTimeAgo(value);
  }
}

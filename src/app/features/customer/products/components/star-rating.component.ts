import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { CustomerIconComponent } from '../../../../shared/customer/components/icon/customer-icon.component';

/**
 * StarRating — chuyển từ React: src/components/product/WriteReviewForm.jsx
 */
@Component({
  selector: 'div[app-star-rating]',
  standalone: true,
  imports: [CustomerIconComponent],
  templateUrl: './star-rating.component.html',
  styleUrl: './star-rating.component.scss',
  host: {
    'class': 'flex h-6 items-center gap-[2px]',
    'role': 'radiogroup',
    'aria-label': 'Đánh giá sao',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StarRatingComponent {
  // --- Input / Output (props của React) ---
  readonly value = input<any>(undefined);
  readonly onChange = output<any>();

  /** (tự sinh) Array.from(...) -> mảng để lặp bằng @for */
  protected range1(): any[] {
    return (Array.from({ length: 5 }) as any);
  }
}

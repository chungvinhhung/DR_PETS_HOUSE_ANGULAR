import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { RatingStarComponent } from './rating-star.component';
import { ReactStyleDirective } from '../../directives/react-style.directive';

/**
 * ProductRating — chuyển từ React: src/components/product/ProductRating.jsx
 */
@Component({
  selector: 'app-product-rating',
  standalone: true,
  imports: [RatingStarComponent, ReactStyleDirective],
  templateUrl: './product-rating.component.html',
  styleUrl: './product-rating.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductRatingComponent {
  // --- Input / Output (props của React) ---
  readonly value = input<any>(0);
  readonly max = input<any>(5);
  readonly size = input<any>(20);
  readonly gap = input<any>(5);
  readonly fillColor = input<any>("#FFB400");
  readonly emptyColor = input<any>("rgba(0,0,0,0.23)");
  readonly className = input<any>("");

  // --- Giá trị tính toán (computed) ---
  readonly rating = computed<any>(() => Math.min(Math.max(Number(this.value()) || 0, 0), this.max()));

  /** (tự sinh) global Array không dùng trực tiếp được trong template */
  protected list1(): any {
    return (Array.from({ length: this.max() }) as any);
  }

  /** (tự sinh) global Math không dùng trực tiếp được trong template */
  protected compute2(index: any): any {
    return Math.min(Math.max(Number(this.rating()) - index, 0), 1) * 100;
  }
}

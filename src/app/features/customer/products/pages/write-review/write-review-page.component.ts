import { ChangeDetectionStrategy, Component } from '@angular/core';

import { ProductDetailsPageComponent } from '../product-details/product-details-page.component';

/**
 * WriteReviewPage — chuyển từ React: src/pages/Product/WriteReviewPage.jsx
 */
@Component({
  selector: 'app-write-review-page',
  standalone: true,
  imports: [ProductDetailsPageComponent],
  templateUrl: './write-review-page.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WriteReviewPageComponent {
}

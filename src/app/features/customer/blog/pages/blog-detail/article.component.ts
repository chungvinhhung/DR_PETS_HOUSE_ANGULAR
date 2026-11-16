import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { CategoryIconComponent } from '../../../../../shared/customer/components/blog-card/category-icon.component';
import { CustomerIconComponent } from '../../../../../shared/customer/components/icon/customer-icon.component';

/**
 * Article — chuyển từ React: src/pages/Blog/BlogDetailPage.jsx
 */
@Component({
  selector: 'article[app-article]',
  standalone: true,
  imports: [CategoryIconComponent, CustomerIconComponent],
  templateUrl: './article.component.html',
  styleUrl: './article.component.scss',
  host: {
    'class': 'w-full rounded-[12px] bg-white px-5 pb-8 pt-6 sm:px-8',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleComponent {
  // --- Input / Output (props của React) ---
  readonly post = input<any>(undefined);

}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { CategoryIconComponent } from '../../../../../shared/customer/components/blog-card/category-icon.component';
import { CustomerIconComponent } from '../../../../../shared/customer/components/icon/customer-icon.component';
import { CustomerLinkDirective } from '../../../../../shared/customer/directives/customer-link.directive';

/**
 * Article — chuyển từ React: src/pages/Blog/BlogDetailPage.jsx
 */
@Component({
  selector: 'article[app-article]',
  standalone: true,
  imports: [CategoryIconComponent, CustomerIconComponent, CustomerLinkDirective],
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
  /**
   * Published rich-text content is HTML in the API, not plain text. Rendering
   * each split paragraph with interpolation leaks literal <h3>, <p>, <li> tags.
   * Angular's [innerHTML] binding sanitizes untrusted markup automatically.
   * Legacy plain-text fixture posts retain the original curated page layout.
   */
  readonly hasRichContent = computed(() =>
    /<\/?(?:h[1-6]|p|ul|ol|li|blockquote|div|table|br|strong|em)(?:\s|\/?>)/i
      .test(String(this.post()?.content || '')),
  );
  protected readonly encodeURIComponent = encodeURIComponent;
}

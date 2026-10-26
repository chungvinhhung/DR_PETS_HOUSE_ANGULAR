import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { CategoryIconComponent } from '../../../../../shared/customer/components/blog-card/category-icon.component';
import { CustomerIconComponent } from '../../../../../shared/customer/components/icon/customer-icon.component';
import { CustomerLinkDirective } from '../../../../../shared/customer/directives/customer-link.directive';
import { FEATURED_BLOG_POST } from '../../../../../shared/customer/data/blog-data';

/**
 * FeaturedPost — chuyển từ React: src/pages/Blog/BlogPage.jsx
 */
@Component({
  selector: 'app-featured-post',
  standalone: true,
  imports: [CategoryIconComponent, CustomerIconComponent, CustomerLinkDirective],
  templateUrl: './featured-post.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturedPostComponent {
  // --- Input / Output (props của React) ---
  readonly post = input<any>(FEATURED_BLOG_POST);

  // --- Giá trị tính toán (computed) ---
  readonly href = computed<any>(() => `/blog/${this.post().id}`);

}

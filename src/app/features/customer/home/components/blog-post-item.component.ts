import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { CategoryIconComponent } from '../../../../shared/customer/components/blog-card/category-icon.component';
import { CustomerIconComponent } from '../../../../shared/customer/components/icon/customer-icon.component';
import { CustomerLinkDirective } from '../../../../shared/customer/directives/customer-link.directive';

/**
 * BlogPostItem — chuyển từ React: src/components/home/BlogSection.jsx
 */
@Component({
  selector: 'app-blog-post-item',
  standalone: true,
  imports: [CategoryIconComponent, CustomerIconComponent, CustomerLinkDirective],
  templateUrl: './blog-post-item.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogPostItemComponent {
  // --- Input / Output (props của React) ---
  readonly post = input<any>(undefined);
  readonly highlighted = input<any>(undefined);

}

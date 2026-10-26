import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { CategoryBadgeComponent } from './category-badge.component';
import { CustomerIconComponent } from '../icon/customer-icon.component';
import { CustomerLinkDirective } from '../../directives/customer-link.directive';

/**
 * BlogCard — chuyển từ React: src/components/blog/BlogCard.jsx
 */
@Component({
  selector: 'article[app-blog-card]',
  standalone: true,
  imports: [CategoryBadgeComponent, CustomerIconComponent, CustomerLinkDirective],
  templateUrl: './blog-card.component.html',
  host: {
    'class': 'group flex h-[343px] w-[288px] flex-col overflow-hidden rounded-[24px] border border-[#fff7ed] bg-white p-px shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_28px_rgba(13,71,161,0.12)]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogCardComponent {
  // --- Input / Output (props của React) ---
  readonly post = input<any>(undefined);

  // --- Giá trị tính toán (computed) ---
  readonly href = computed<any>(() => `/blog/${this.post().id}`);

}

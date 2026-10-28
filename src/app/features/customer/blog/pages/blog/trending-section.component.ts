import { ChangeDetectionStrategy, Component, ElementRef, input, viewChild } from '@angular/core';

import { CategoryIconComponent } from '../../../../../shared/customer/components/blog-card/category-icon.component';
import { CustomerIconComponent } from '../../../../../shared/customer/components/icon/customer-icon.component';
import { CustomerLinkDirective } from '../../../../../shared/customer/directives/customer-link.directive';
import { TRENDING_BLOG_POSTS } from '../../../../../shared/customer/data/blog-data';

/**
 * TrendingSection — chuyển từ React: src/pages/Blog/BlogPage.jsx
 */
@Component({
  selector: 'section[app-trending-section]',
  standalone: true,
  imports: [CategoryIconComponent, CustomerIconComponent, CustomerLinkDirective],
  templateUrl: './trending-section.component.html',
  host: {
    'class': 'w-[1200px] pt-4',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrendingSectionComponent {
  // --- Input / Output (props của React) ---
  readonly posts = input<any>(TRENDING_BLOG_POSTS);

  // --- Trạng thái (signal = useState / useRef) ---
  readonly scrollRef = viewChild<ElementRef<any>>('scrollRef');

  protected scroll(direction: any) {
    this.scrollRef()?.nativeElement?.scrollBy({ left: direction * 344, behavior: "smooth" });
  }
}

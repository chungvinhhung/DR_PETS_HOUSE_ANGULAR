import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { SectionHeadingComponent } from './section-heading.component';
import { BlogCardComponent } from '../../../../../shared/customer/components/blog-card/blog-card.component';
import { CustomerIconComponent } from '../../../../../shared/customer/components/icon/customer-icon.component';

/**
 * RelatedBlogSection — chuyển từ React: src/pages/Blog/BlogDetailPage.jsx
 */
@Component({
  selector: 'app-related-blog-section',
  standalone: true,
  imports: [SectionHeadingComponent, BlogCardComponent, CustomerIconComponent],
  templateUrl: './related-blog-section.component.html',
  styleUrl: './related-blog-section.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RelatedBlogSectionComponent {
  // --- Input / Output (props của React) ---
  readonly posts = input<any>(undefined);

  // --- Giá trị tính toán (computed) ---
  readonly visible = computed<any>(() => (Array.from({ length: 4 }, (_: any, index: any) => (this.posts() as any)[(this.start() + index) % this.posts().length]) as any));

  // --- Trạng thái (signal = useState / useRef) ---
  readonly start = signal<any>(0);

  protected handle1() {
    this.start.update((value: any) => (value - 1 + this.posts().length) % this.posts().length);
  }

  protected handle2() {
    this.start.update((value: any) => (value + 1) % this.posts().length);
  }
}

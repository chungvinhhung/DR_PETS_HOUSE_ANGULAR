import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { CustomerIconComponent } from '../../../../../shared/customer/components/icon/customer-icon.component';
import { CustomerLinkDirective } from '../../../../../shared/customer/directives/customer-link.directive';
import { FIRST_AID_POSTS } from '../../../../../shared/customer/data/first-aid-data';

/**
 * RelatedSection — chuyển từ React: src/pages/Blog/FirstAidDetailPage.jsx
 */
@Component({
  selector: 'app-related-section',
  standalone: true,
  imports: [CustomerIconComponent, CustomerLinkDirective],
  templateUrl: './related-section.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RelatedSectionComponent {
  // --- Input / Output (props của React) ---
  readonly currentId = input<any>(undefined);
  readonly sourcePosts = input<any>(FIRST_AID_POSTS, { alias: 'posts' });

  // --- Giá trị tính toán (computed) ---
  readonly posts = computed<any>(() => this.sourcePosts().filter((post: any) => post.id !== this.currentId()));
  readonly visiblePosts = computed<any>(() => (Array.from({ length: 3 }, (_: any, index: any) => (this.posts() as any)[(this.start() + index) % this.posts().length]) as any));

  // --- Trạng thái (signal = useState / useRef) ---
  readonly start = signal<any>(0);

  protected move(amount: any) {
    return this.start.update((value: any) => (value + amount + this.posts().length) % this.posts().length);
  }
}

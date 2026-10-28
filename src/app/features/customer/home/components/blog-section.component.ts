import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, inject, signal } from '@angular/core';

import { ContentApiService } from '../../../../core/customer/services/api/content-api.service';
import { CategoryIconComponent } from '../../../../shared/customer/components/blog-card/category-icon.component';
import { BlogPostItemComponent } from './blog-post-item.component';
import { CustomerIconComponent } from '../../../../shared/customer/components/icon/customer-icon.component';
import { CustomerLinkDirective } from '../../../../shared/customer/directives/customer-link.directive';
import { ALL_BLOG_POSTS, FEATURED_BLOG_POST } from '../../../../shared/customer/data/blog-data';

/**
 * BlogSection — chuyển từ React: src/components/home/BlogSection.jsx
 */
@Component({
  selector: 'section[app-blog-section]',
  standalone: true,
  imports: [CategoryIconComponent, BlogPostItemComponent, CustomerIconComponent, CustomerLinkDirective],
  templateUrl: './blog-section.component.html',
  host: {
    'id': 'blog',
    'class': 'w-full bg-white py-10 md:py-12',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogSectionComponent {
  // --- Service dùng chung ---
  protected readonly contentApi = inject(ContentApiService);
  private readonly destroyRef = inject(DestroyRef);

  // --- Trạng thái (signal = useState / useRef) ---
  readonly featuredPost = signal<any>(FEATURED_BLOG_POST);
  readonly latestPosts = signal<any>((() => ALL_BLOG_POSTS.slice(0, 4))());
  readonly fallbackNotice = signal<any>("");

  constructor() {
    // useEffect(..., []) -> chạy 1 lần sau khi render
    afterNextRender(() => {
      const cleanup = (() => {
        let active = true;
        this.fallbackNotice.set("");

        Promise.all([
          this.contentApi.getFeaturedPost(),
          this.contentApi.getPostsPage({ type: "official_blog", limit: 4, page: 1 }),
        ])
          .then(async ([apiFeatured, apiPosts]: any) => {
            if (!active) return;
            const officialPosts = apiPosts.posts.filter((post: any) => post.section === "knowledge");

            if (apiFeatured?.section === "knowledge") {
              this.featuredPost.set(apiFeatured);
            } else if (officialPosts[0]) {
              this.featuredPost.set(officialPosts[0]);
            }

            if (officialPosts.length) {
              this.latestPosts.set(officialPosts.slice(0, 4));
              return;
            }

            const allPosts = await this.contentApi.getPostsPage({ limit: 4, page: 1 });
            if (!active) return;
            const fallbackApiPosts = allPosts.posts.filter((post: any) => post.section === "knowledge");
            if (fallbackApiPosts.length) {
              this.latestPosts.set(fallbackApiPosts.slice(0, 4));
              if (fallbackApiPosts[0]) this.featuredPost.set(fallbackApiPosts[0]);
              return;
            }

            this.fallbackNotice.set("API blog chưa có dữ liệu, đang hiển thị bài viết mẫu.");
          })
          .catch((error: any) => {
            if (!active) return;
            this.fallbackNotice.set(error?.message || "Không thể tải blog mới nhất, đang hiển thị bài viết mẫu.");
          });

        return () => {
          active = false;
        };
      })();
      if (typeof cleanup === 'function') this.destroyRef.onDestroy(cleanup);
    });
  }

}

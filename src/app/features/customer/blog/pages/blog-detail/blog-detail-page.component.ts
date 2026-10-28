import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, effect, inject, signal, untracked } from '@angular/core';

import { CustomerNavigationService } from '../../../../../core/customer/services/customer-navigation.service';
import { ContentApiService } from '../../../../../core/customer/services/api/content-api.service';
import { ProductApiService } from '../../../../../core/customer/services/api/product-api.service';
import { CanvasLayoutComponent } from '../../../../../shared/customer/components/canvas-layout/canvas-layout.component';
import { NavBarComponent } from '../../../../../layouts/customer/components/navbar/nav-bar.component';
import { BreadcrumbComponent } from '../../../../../shared/customer/components/breadcrumb/breadcrumb.component';
import { ArticleComponent } from './article.component';
import { BlogSidebarComponent } from './blog-sidebar.component';
import { SectionHeadingComponent } from './section-heading.component';
import { ShoppingProductCardComponent } from '../../../../../shared/customer/components/shopping-product-card/shopping-product-card.component';
import { RelatedBlogSectionComponent } from './related-blog-section.component';
import { FooterComponent } from '../../../../../layouts/customer/components/footer/footer.component';
import { BLOG_SECTIONS, FEATURED_BLOG_POST, QUICK_READ_POSTS, ALL_BLOG_POSTS, TRENDING_BLOG_POSTS } from '../../../../../shared/customer/data/blog-data';
import { FEATURED_PRODUCTS } from '../../../../../shared/customer/data/shop-data';

/**
 * BlogDetailPage — chuyển từ React: src/pages/Blog/BlogDetailPage.jsx
 */
@Component({
  selector: 'div[app-blog-detail-page]',
  standalone: true,
  imports: [CanvasLayoutComponent, NavBarComponent, BreadcrumbComponent, ArticleComponent, BlogSidebarComponent, SectionHeadingComponent, ShoppingProductCardComponent, RelatedBlogSectionComponent, FooterComponent],
  templateUrl: './blog-detail-page.component.html',
  host: {
    'class': 'min-h-screen bg-white',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogDetailPageComponent {
  // --- Service dùng chung ---
  protected readonly navService = inject(CustomerNavigationService);
  protected readonly contentApi = inject(ContentApiService);
  protected readonly productApi = inject(ProductApiService);
  private readonly destroyRef = inject(DestroyRef);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly ALL_BLOG_POSTS: any = ALL_BLOG_POSTS;

  // --- Giá trị tính toán (computed) ---
  readonly fallbackPost = computed<any>(() => {
    const selected = [...ALL_BLOG_POSTS, ...TRENDING_BLOG_POSTS, ...QUICK_READ_POSTS].find(
      (item: any) => item.id === this.navService.params()['postId'],
    );
    return selected
      ? { ...FEATURED_BLOG_POST, ...selected, author: FEATURED_BLOG_POST.author, tags: FEATURED_BLOG_POST.tags }
      : FEATURED_BLOG_POST;
  });
  readonly section = computed<any>(() => (BLOG_SECTIONS as any)[this.post().section] || BLOG_SECTIONS.knowledge);

  // --- Trạng thái (signal = useState / useRef) ---
  readonly post = signal<any>(this.fallbackPost());
  readonly relatedPosts = signal<any>(ALL_BLOG_POSTS);
  readonly relatedProducts = signal<any>((() => FEATURED_PRODUCTS.slice(0, 6))());
  readonly productNotice = signal<any>("");
  readonly isLoading = signal<any>(false);
  readonly loadError = signal<any>("");

  constructor() {
    // useEffect(..., [fallbackPost, postId])
    effect((onCleanup: any) => {
      this.fallbackPost();
      this.navService.params()['postId'];
      const cleanup = untracked(() => {
        let active = true;
        this.post.set(this.fallbackPost());
        this.isLoading.set(true);
        this.loadError.set("");

        Promise.all([
          this.contentApi.getPostBySlug(this.navService.params()['postId']),
          this.contentApi.getPostsPage({ type: "official_blog", limit: 12 }),
        ])
          .then(([apiPost, apiRelated]: any) => {
            if (!active) return;
            this.post.set(apiPost);
            if (apiRelated.posts.length) {
              this.relatedPosts.set(apiRelated.posts.filter((item: any) => item.id !== apiPost.id));
            }
          })
          .catch((error: any) => {
            if (!active) return;
            this.loadError.set(error?.message || "Không thể tải bài viết, đang hiển thị dữ liệu mẫu từ giao diện.");
          })
          .finally(() => {
            if (active) this.isLoading.set(false);
          });

        return () => {
          active = false;
        };
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });

    // useEffect(..., []) -> chạy 1 lần sau khi render
    afterNextRender(() => {
      const cleanup = (() => {
        let active = true;
        this.productNotice.set("");

        this.productApi.getProductsPage({ sort: "best_selling", limit: 6, page: 1 })
          .then((payload: any) => {
            if (!active) return;
            if (payload.products.length) {
              this.relatedProducts.set(payload.products.slice(0, 6));
              return;
            }
            this.productNotice.set("API sản phẩm liên quan chưa có dữ liệu, đang hiển thị sản phẩm mẫu.");
          })
          .catch((error: any) => {
            if (!active) return;
            this.productNotice.set(error?.message || "Không thể tải sản phẩm liên quan, đang hiển thị sản phẩm mẫu.");
          });

        return () => {
          active = false;
        };
      })();
      if (typeof cleanup === 'function') this.destroyRef.onDestroy(cleanup);
    });
  }

}

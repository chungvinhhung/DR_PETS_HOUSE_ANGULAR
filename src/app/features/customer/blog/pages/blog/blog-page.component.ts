import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, effect, inject, signal, untracked } from '@angular/core';

import { CustomerNavigationService } from '../../../../../core/customer/services/customer-navigation.service';
import { ContentApiService } from '../../../../../core/customer/services/api/content-api.service';
import { CanvasLayoutComponent } from '../../../../../shared/customer/components/canvas-layout/canvas-layout.component';
import { NavBarComponent } from '../../../../../layouts/customer/components/navbar/nav-bar.component';
import { FeaturedPostComponent } from './featured-post.component';
import { TrendingSectionComponent } from './trending-section.component';
import { CategoryIconComponent } from '../../../../../shared/customer/components/blog-card/category-icon.component';
import { BlogCardComponent } from '../../../../../shared/customer/components/blog-card/blog-card.component';
import { FooterComponent } from '../../../../../layouts/customer/components/footer/footer.component';
import { CustomerLinkDirective } from '../../../../../shared/customer/directives/customer-link.directive';
import { blogImages } from '../../../../../shared/customer/assets/blog-images';
import { productImages } from '../../../../../shared/customer/assets/product-images';
import { BLOG_CATEGORIES, FEATURED_BLOG_POST, ALL_BLOG_POSTS, TRENDING_BLOG_POSTS } from '../../../../../shared/customer/data/blog-data';
import { PAGE_SIZE } from './blog-page.helpers';

/**
 * BlogPage — chuyển từ React: src/pages/Blog/BlogPage.jsx
 */
@Component({
  selector: 'div[app-blog-page]',
  standalone: true,
  imports: [CanvasLayoutComponent, NavBarComponent, FeaturedPostComponent, TrendingSectionComponent, CategoryIconComponent, BlogCardComponent, FooterComponent, CustomerLinkDirective],
  templateUrl: './blog-page.component.html',
  host: {
    'class': 'min-h-screen bg-white',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogPageComponent {
  // --- Service dùng chung ---
  protected readonly navService = inject(CustomerNavigationService);
  protected readonly contentApi = inject(ContentApiService);
  private readonly destroyRef = inject(DestroyRef);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly blogImages: any = blogImages;
  protected readonly productImages: any = productImages;

  // --- Giá trị tính toán (computed) ---
  readonly filteredPosts = computed<any>(() => {
    const keyword = this.searchQuery().trim().toLocaleLowerCase("vi");
    return this.allPosts().filter((post: any) => {
      if (this.category() !== "all" && post.category !== this.category()) return false;
      if (!keyword) return true;
      return [post.title, post.excerpt, post.categoryLabel].some((value: any) =>
        value.toLocaleLowerCase("vi").includes(keyword),
      );
    });
  });
  readonly initialCategory = computed<any>(() => this.navService.searchParams().get("category"));
  readonly initialKeyword = computed<any>(() => this.navService.searchParams().get("keyword") || "");
  readonly posts = computed<any>(() => this.filteredPosts().slice(0, this.visibleCount()));
  readonly total = computed<any>(() => this.filteredPosts().length);

  // --- Trạng thái (signal = useState / useRef) ---
  readonly category = signal<any>(BLOG_CATEGORIES.some((item: any) => item.id === this.initialCategory()) ? this.initialCategory() : "all");
  readonly search = signal<any>(this.initialKeyword());
  readonly searchQuery = signal<any>(this.initialKeyword());
  readonly visibleCount = signal<any>(PAGE_SIZE);
  readonly categories = signal<any>(BLOG_CATEGORIES);
  readonly featuredPost = signal<any>(FEATURED_BLOG_POST);
  readonly trendingPosts = signal<any>(TRENDING_BLOG_POSTS);
  readonly allPosts = signal<any>(ALL_BLOG_POSTS);
  readonly isLoading = signal<any>(false);
  readonly loadError = signal<any>("");
  readonly apiEmptyMessage = signal<any>("");

  constructor() {
    // useEffect(..., [categories, searchParams])
    effect((onCleanup: any) => {
      this.categories();
      this.navService.searchParams();
      const cleanup = untracked(() => {
        const categoryParam = this.navService.searchParams().get("category");
        const nextCategory = this.categories().some((item: any) => item.id === categoryParam)
          ? categoryParam
          : "all";
        const keyword = this.navService.searchParams().get("keyword") || "";
        this.category.set(nextCategory);
        this.search.set(keyword);
        this.searchQuery.set(keyword);
        this.visibleCount.set(PAGE_SIZE);
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });

    // useEffect(..., []) -> chạy 1 lần sau khi render
    afterNextRender(() => {
      const cleanup = (() => {
        let active = true;
        this.isLoading.set(true);
        this.loadError.set("");
        this.apiEmptyMessage.set("");

        Promise.all([
          this.contentApi.getBlogCategories(),
          this.contentApi.getFeaturedPost(),
          this.contentApi.getTrendingPosts(5),
          this.contentApi.getPostsPage({ type: "official_blog", limit: 100 }),
        ])
          .then(async ([apiCategories, apiFeatured, apiTrending, apiPosts]: any) => {
            if (!active) return;
            if (apiCategories.length > 1) this.categories.set(apiCategories);
            if (apiFeatured) this.featuredPost.set(apiFeatured);
            if (apiTrending.length) this.trendingPosts.set(apiTrending);
            if (apiPosts.posts.length) {
              // Admin-selected featured frame takes precedence only if the
              // published API actually persisted and returned layoutType.
              const featured = apiPosts.posts.find((post: any) => post.layoutType === 'FEATURED');
              if (featured) this.featuredPost.set(featured);
              this.allPosts.set(apiPosts.posts);
              return;
            }

            const allApiPosts = await this.contentApi.getPostsPage({ limit: 100 });
            if (!active) return;

            const officialPosts = allApiPosts.posts.filter((post: any) => post.section === "knowledge");
            if (officialPosts.length) {
              this.allPosts.set(officialPosts);
              return;
            }

            this.apiEmptyMessage.set("API blog chưa có dữ liệu, đang hiển thị dữ liệu mẫu từ giao diện.");
          })
          .catch((error: any) => {
            if (!active) return;
            this.apiEmptyMessage.set(error?.message || "Không thể tải bài viết mới nhất, đang hiển thị dữ liệu mẫu từ giao diện.");
          })
          .finally(() => {
            if (active) this.isLoading.set(false);
          });

        return () => {
          active = false;
        };
      })();
      if (typeof cleanup === 'function') this.destroyRef.onDestroy(cleanup);
    });

    // useEffect(..., [location.hash, category])
    effect((onCleanup: any) => {
      this.navService.location().hash;
      this.category();
      const cleanup = untracked(() => {
        if (this.navService.location().hash !== "#latest-posts") return;
        window.requestAnimationFrame(() => {
          (document.getElementById("latest-posts") as any)?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });
  }

  protected updateParams(nextCategory: any, keyword: any) {
    const params: any = {};
    if (nextCategory !== "all") params.category = nextCategory;
    if (keyword) params.keyword = keyword;
    this.navService.setSearchParams(params);
  }

  protected selectCategory(id: any) {
    this.category.set(id);
    this.visibleCount.set(PAGE_SIZE);
    this.updateParams(id, this.searchQuery());
  }

  protected submitSearch() {
    const keyword = this.search().trim();
    this.searchQuery.set(keyword);
    this.visibleCount.set(PAGE_SIZE);
    this.updateParams(this.category(), keyword);
  }

  protected handle1(event: any) {
    event.preventDefault();
    this.submitSearch();
  }

  protected handle2() {
    this.search.set("");
    this.searchQuery.set("");
    this.visibleCount.set(PAGE_SIZE);
    this.updateParams(this.category(), "");
  }

  protected handle3() {
    this.visibleCount.update((count: any) => count + PAGE_SIZE);
  }
}

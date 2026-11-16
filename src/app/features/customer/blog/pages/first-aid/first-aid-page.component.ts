import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, effect, inject, signal, untracked } from '@angular/core';

import { CustomerNavigationService } from '../../../../../core/customer/services/customer-navigation.service';
import { ContentApiService } from '../../../../../core/customer/services/api/content-api.service';
import { CanvasLayoutComponent } from '../../../../../shared/customer/components/canvas-layout/canvas-layout.component';
import { NavBarComponent } from '../../../../../layouts/customer/components/navbar/nav-bar.component';
import { FirstAidTabsComponent } from './first-aid-tabs.component';
import { FirstAidCardComponent } from './first-aid-card.component';
import { SupportCardsComponent } from './support-cards.component';
import { FooterComponent } from '../../../../../layouts/customer/components/footer/footer.component';
import { blogImages } from '../../../../../shared/customer/assets/blog-images';
import { productImages } from '../../../../../shared/customer/assets/product-images';
import { FIRST_AID_CATEGORIES, FIRST_AID_POSTS } from '../../../../../shared/customer/data/first-aid-data';
import { PAGE_SIZE } from './first-aid-page.helpers';

/**
 * FirstAidPage — chuyển từ React: src/pages/Blog/FirstAidPage.jsx
 */
@Component({
  selector: 'div[app-first-aid-page]',
  standalone: true,
  imports: [CanvasLayoutComponent, NavBarComponent, FirstAidTabsComponent, FirstAidCardComponent, SupportCardsComponent, FooterComponent],
  templateUrl: './first-aid-page.component.html',
  styleUrl: './first-aid-page.component.scss',
  host: {
    'class': 'min-h-screen bg-white',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FirstAidPageComponent {
  // --- Service dùng chung ---
  protected readonly navService = inject(CustomerNavigationService);
  protected readonly contentApi = inject(ContentApiService);
  private readonly destroyRef = inject(DestroyRef);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly blogImages: any = blogImages;
  protected readonly productImages: any = productImages;

  // --- Giá trị tính toán (computed) ---
  readonly filteredPosts = computed<any>(() => {
    const keyword = this.search().trim().toLocaleLowerCase("vi");
    return this.allPosts().filter((post: any) => {
      if (this.category() !== "all" && post.category !== this.category()) return false;
      return !keyword || [post.title, post.description, post.categoryLabel].some((value: any) =>
        value.toLocaleLowerCase("vi").includes(keyword),
      );
    });
  });
  readonly initialCategory = computed<any>(() => this.navService.searchParams().get("category"));
  readonly visiblePosts = computed<any>(() => this.filteredPosts().slice(0, this.visibleCount()));

  // --- Trạng thái (signal = useState / useRef) ---
  readonly category = signal<any>(FIRST_AID_CATEGORIES.some((item: any) => item.id === this.initialCategory()) ? this.initialCategory() : "all");
  readonly search = signal<any>("");
  readonly visibleCount = signal<any>(PAGE_SIZE);
  readonly categories = signal<any>(FIRST_AID_CATEGORIES);
  readonly allPosts = signal<any>(FIRST_AID_POSTS);
  readonly isLoading = signal<any>(false);
  readonly loadError = signal<any>("");
  readonly apiEmptyMessage = signal<any>("");

  constructor() {
    // useEffect(..., []) -> chạy 1 lần sau khi render
    afterNextRender(() => {
      const cleanup = (() => {
        let active = true;
        this.isLoading.set(true);
        this.loadError.set("");
        this.apiEmptyMessage.set("");

        Promise.all([
          this.contentApi.getFirstAidCategories(),
          this.contentApi.getFirstAidGuidesPage({ limit: 100 }),
        ])
          .then(([apiCategories, apiGuides]: any) => {
            if (!active) return;
            if (apiCategories.length > 1) this.categories.set(apiCategories);
            if (apiGuides.guides.length) {
              this.allPosts.set(apiGuides.guides);
              return;
            }

            this.apiEmptyMessage.set("API cẩm nang sơ cứu chưa có dữ liệu, đang hiển thị dữ liệu mẫu từ giao diện.");
          })
          .catch((error: any) => {
            if (!active) return;
            this.apiEmptyMessage.set(error?.message || "Không thể tải cẩm nang sơ cứu, đang hiển thị dữ liệu mẫu từ giao diện.");
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

    // useEffect(..., [categories, searchParams])
    effect((onCleanup: any) => {
      this.categories();
      this.navService.searchParams();
      const cleanup = untracked(() => {
        const categoryParam = this.navService.searchParams().get("category");
        this.category.set(this.categories().some((item: any) => item.id === categoryParam) ? categoryParam : "all");
        this.visibleCount.set(PAGE_SIZE);
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });
  }

  protected chooseCategory(id: any) {
    this.category.set(id);
    this.visibleCount.set(PAGE_SIZE);
    this.navService.setSearchParams(id === "all" ? {} : { category: id });
  }

  protected handle1() {
    this.search.set("");
    this.visibleCount.set(PAGE_SIZE);
  }

  protected handle2() {
    this.visibleCount.update((count: any) => count + PAGE_SIZE);
  }
}

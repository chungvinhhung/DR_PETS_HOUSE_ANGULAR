import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, effect, inject, signal, untracked } from '@angular/core';

import { CustomerNavigationService } from '../../../../../core/customer/services/customer-navigation.service';
import { ProductApiService } from '../../../../../core/customer/services/api/product-api.service';
import { NavBarComponent } from '../../../../../layouts/customer/components/navbar/nav-bar.component';
import { BreadcrumbComponent } from '../../../../../shared/customer/components/breadcrumb/breadcrumb.component';
import { FilterSidebarComponent } from './filter-sidebar.component';
import { ProductSearchAndSortComponent } from './product-search-and-sort.component';
import { ProductGridComponent } from './product-grid.component';
import { LoadMoreComponent } from './load-more.component';
import { FooterComponent } from '../../../../../layouts/customer/components/footer/footer.component';
import { PRODUCT_CATEGORIES as CATEGORIES } from '../../../../../shared/customer/data/shop-data';
import { reactSetter } from '../../../../../shared/customer/utils/react-setter';
import { PAGE_SIZE, MULTI_CATEGORY_FETCH_LIMIT, buildCategoryOptions, toBackendSort, sortProducts, getFallbackProducts, buildFetchSpecs } from './product-page.helpers';

/**
 * ProductPage — chuyển từ React: src/pages/Product/ProductPage.jsx
 */
@Component({
  selector: 'div[app-product-page]',
  standalone: true,
  imports: [NavBarComponent, BreadcrumbComponent, FilterSidebarComponent, ProductSearchAndSortComponent, ProductGridComponent, LoadMoreComponent, FooterComponent],
  templateUrl: './product-page.component.html',
  host: {
    'class': 'min-h-screen bg-[#f5f5f5]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductPageComponent {
  // --- Service dùng chung ---
  protected readonly navService = inject(CustomerNavigationService);
  protected readonly productApi = inject(ProductApiService);
  private readonly destroyRef = inject(DestroyRef);

  // --- Giá trị tính toán (computed) ---
  readonly categoryOptions = computed<any>(() => buildCategoryOptions(this.apiCategories()));
  readonly selectedCategoryIds = computed<any>(() => {
    return (this.selectedCategories()
      .map((selectedCategory: any) => this.categoryOptions().find((category: any) => category.index === selectedCategory)?.categoryId)
      .filter(Boolean) as any[]);
  }, {
    equal: (a: any[], b: any[]) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((val, i) => String(val) === String(b[i])),
  });

  // --- Trạng thái (signal = useState / useRef) ---
  readonly products = signal<any>([]);
  readonly search = signal<any>("");
  readonly searchQuery = signal<any>("");
  readonly sortOrder = signal<any>("");
  readonly selectedCategories = signal<any>([]);
  readonly selectedPrices = signal<any>([]);
  readonly apiCategories = signal<any>([]);
  readonly totalProducts = signal<any>(0);
  readonly totalPages = signal<any>(1);
  readonly currentPage = signal<any>(1);
  readonly isLoading = signal<any>(false);
  readonly isLoadingProducts = signal<any>(true);
  readonly loadError = signal<any>("");

  /** Hàm set kiểu React cho signal "searchQuery" (dùng khi truyền cho component con / callback) */
  protected readonly setSearchQueryFn = reactSetter(this.searchQuery);
  /** Hàm set kiểu React cho signal "sortOrder" (dùng khi truyền cho component con / callback) */
  protected readonly setSortOrderFn = reactSetter(this.sortOrder);

  constructor() {
    // useEffect(..., []) -> chạy 1 lần sau khi render
    afterNextRender(() => {
      const cleanup = (() => {
        let active = true;

        this.productApi.getProductCategories()
          .then((items: any) => {
            if (active) this.apiCategories.set(Array.isArray(items) ? items : []);
          })
          .catch(() => {
            if (active) this.apiCategories.set([]);
          });

        return () => {
          active = false;
        };
      })();
      if (typeof cleanup === 'function') this.destroyRef.onDestroy(cleanup);
    });

    // useEffect(..., [loadProducts]) - Tự động tải lại trang 1 khi các bộ lọc thay đổi
    effect((onCleanup: any) => {
      // Đăng ký dependencies để effect tự động kích hoạt khi bộ lọc / tìm kiếm / sắp xếp thay đổi
      this.selectedCategoryIds();
      this.selectedPrices();
      this.searchQuery();
      this.sortOrder();

      let active = true;
      untracked(() => {
        this.loadProducts(1, false).finally(() => {
          if (!active) return;
        });
      });

      onCleanup(() => {
        active = false;
      });
    });

    // useEffect(..., [searchParams])
    effect((onCleanup: any) => {
      this.navService.searchParams();
      const cleanup = untracked(() => {
        const categorySlug = this.navService.searchParams().get("category");
        const keyword = this.navService.searchParams().get("keyword");
        const categoryIndex = CATEGORIES.findIndex((category: any) => category.slug === categorySlug);
        this.selectedCategories.set(categoryIndex >= 0 ? [categoryIndex] : []);
        this.search.set(keyword ?? "");
        this.searchQuery.set(keyword ?? "");
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });
  }

  protected async loadProducts(page: any = 1, append: any = false) {
    const fetchSpecs = buildFetchSpecs({ selectedCategoryIds: this.selectedCategoryIds(), selectedPrices: this.selectedPrices() });
    const params = {
      page,
      limit: PAGE_SIZE,
      category_id: this.selectedCategoryIds()[0] || undefined,
      category_ids: this.selectedCategoryIds().length ? this.selectedCategoryIds().join(",") : undefined,
      filter: this.searchQuery().trim() || undefined,
      sort: toBackendSort(this.sortOrder()),
    };

    if (append) {
      this.isLoading.set(true);
    } else {
      this.isLoadingProducts.set(true);
    }
    this.loadError.set("");

    try {
      if (fetchSpecs.length > 1) {
        const fetchResults = await Promise.all(
          fetchSpecs.map(({ categoryId, range }: any) =>
            this.productApi.getProductsPage({
              ...params,
              page: 1,
              limit: MULTI_CATEGORY_FETCH_LIMIT,
              category_id: categoryId,
              category_ids: undefined,
              minPrice: range?.min,
              maxPrice: Number.isFinite(range?.max) ? range.max : undefined,
            }),
          ),
        );
        const uniqueProducts = new Map<any, any>();
        fetchResults.forEach((result: any) => {
          result.products.forEach((product: any) => {
            uniqueProducts.set(String(product.id), product);
          });
        });
        const mergedProducts = sortProducts([...uniqueProducts.values()], this.sortOrder());
        const pageProducts = mergedProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

        this.products.update((current: any) => (append ? [...current, ...pageProducts] : pageProducts));
        this.totalProducts.set(mergedProducts.length);
        this.totalPages.set(Math.max(1, Math.ceil(mergedProducts.length / PAGE_SIZE)));
        this.currentPage.set(page);
        return;
      }

      const onlySpec = fetchSpecs[0] || {};
      const result = await this.productApi.getProductsPage({
        ...params,
        category_id: onlySpec.categoryId,
        category_ids: undefined,
        minPrice: onlySpec.range?.min,
        maxPrice: Number.isFinite(onlySpec.range?.max) ? onlySpec.range.max : undefined,
      });
      this.products.update((current: any) => (append ? [...current, ...result.products] : result.products));
      this.totalProducts.set(result.totalRows);
      this.totalPages.set(result.totalPages || 1);
      this.currentPage.set(page);
    } catch {
      const fallbackProducts = getFallbackProducts({ searchQuery: this.searchQuery(), selectedCategories: this.selectedCategories(), selectedPrices: this.selectedPrices(), sortOrder: this.sortOrder() });
      const fallbackPage = fallbackProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
      if (!append) this.products.set(fallbackPage);
      else this.products.update((current: any) => [...current, ...fallbackPage]);
      this.totalProducts.set(fallbackProducts.length);
      this.totalPages.set(Math.max(1, Math.ceil(fallbackProducts.length / PAGE_SIZE)));
      this.currentPage.set(page);
      this.loadError.set("");
    } finally {
      this.isLoading.set(false);
      this.isLoadingProducts.set(false);
    }
  }

  protected resetDisplayCount(setter: any, value: any) {
    setter(value);
  }

  protected toggleCategory(categoryIndex: any) {
    this.selectedCategories.update((current: any) => {
      if (categoryIndex === null) return [];
      return current.includes(categoryIndex)
        ? current.filter((index: any) => index !== categoryIndex)
        : [...current, categoryIndex];
    });
  }

  protected togglePrice(priceIndex: any) {
    this.selectedPrices.update((current: any) =>
      current.includes(priceIndex)
        ? current.filter((index: any) => index !== priceIndex)
        : [...current, priceIndex]);
  }

  protected clearSearch() {
    this.search.set("");
    this.searchQuery.set("");
  }

  protected clearFilters() {
    this.selectedCategories.set([]);
    this.selectedPrices.set([]);
  }

  protected loadMore() {
    if (this.isLoading() || this.currentPage() >= this.totalPages()) return;
    this.loadProducts(this.currentPage() + 1, true);
  }
}

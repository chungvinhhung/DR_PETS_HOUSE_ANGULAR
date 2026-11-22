import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';

import { CustomerNavigationService } from '../../../../core/customer/services/customer-navigation.service';
import { SearchApiService } from '../../../../core/customer/services/api/search-api.service';
import { NavBarComponent } from '../../../../layouts/customer/components/navbar/nav-bar.component';
import { SearchSidebarComponent } from './search-sidebar.component';
import { ResultsHeaderComponent } from './results-header.component';
import { SearchResultsContentComponent } from './search-results-content.component';
import { EmptyResultsContentComponent } from './empty-results-content.component';
import { FooterComponent } from '../../../../layouts/customer/components/footer/footer.component';
import { ReactStyleDirective } from '../../../../shared/customer/directives/react-style.directive';
import { SEARCH_EMPTY_STATE, SEARCH_FILTER_GROUPS, mockSearchApi } from '../../../../shared/customer/data/search-results-data';
import { TYPE_IDS, SORT_OPTIONS, EMPTY_SEARCH_RESPONSE, buildFacets, buildSearchCounts, applySearchFilters } from './search-results-page.helpers';
import { CrossSellService } from '../../../../core/customer/services/cross-sell.service';
import { SeoService } from '../../../../core/customer/services/seo.service';
import { buildSearchPath, buildSearchSlug, searchSlugToQuery } from '../../../../shared/customer/utils/slug';

/**
 * SearchResultsPage — chuyển từ React: src/pages/Search/SearchResultsPage.jsx
 */
@Component({
  selector: 'div[app-search-results-page]',
  standalone: true,
  imports: [NavBarComponent, SearchSidebarComponent, ResultsHeaderComponent, SearchResultsContentComponent, EmptyResultsContentComponent, FooterComponent, ReactStyleDirective],
  templateUrl: './search-results-page.component.html',
  styleUrl: './search-results-page.component.scss',
  host: {
    'class': 'min-h-screen bg-white font-[\'Roboto\']',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchResultsPageComponent {
  // --- Service dùng chung ---
  protected readonly navService = inject(CustomerNavigationService);
  protected readonly searchApi = inject(SearchApiService);
  private readonly crossSell = inject(CrossSellService);
  private readonly seo = inject(SeoService);

  // --- Giá trị tính toán (computed) ---
  readonly filteredSearchResponse = computed<any>(() => {
    const filteredResults = applySearchFilters(this.searchResponse().results, this.selectedFilters(), this.activeType());
    const counts = buildSearchCounts(filteredResults);
    const total = Object.values(counts).reduce((sum: any, count: any) => sum + count, 0);

    return {
      ...this.searchResponse(),
      counts,
      total,
      results: filteredResults,
    };
  });
  readonly pageMinHeight = computed<any>(() => {
    if (!this.hasResults()) return "2285px";
    if (this.activeType() === "service") return "1543px";
    if (this.activeType() === "shopping") return "1314px";
    if (this.activeType() === "article") return "3079px";
    return "4359px";
  });
  /**
   * Từ khóa tìm kiếm, theo thứ tự ưu tiên:
   *  1. history.state.searchQuery — câu gốc có dấu khi người dùng gõ ở ô tìm kiếm (khớp slug hiện tại)
   *  2. slug trên path /tim-kiem/:keyword — vào từ Google/link chia sẻ ("thuc-an-meo" -> "thuc an meo",
   *     SmartSearch tự khôi phục dấu)
   *  3. ?q= của URL cũ /search?q=...
   */
  readonly query = computed<any>(() => {
    const location = this.navService.location();
    const slug = this.navService.params()['keyword'];
    const stateQuery = String(location.state?.searchQuery ?? '').trim();
    if (slug) {
      return stateQuery && buildSearchSlug(stateQuery) === slug ? stateQuery : searchSlugToQuery(slug);
    }
    return this.navService.searchParams().get("q")?.trim() || stateQuery || "tắm";
  });
  readonly urlType = computed<any>(() => this.navService.searchParams().get("type") || "all");
  readonly activeType = computed<any>(() => TYPE_IDS.includes(this.urlType()) ? this.urlType() : "all");
  readonly defaultSort = computed<any>(() => this.activeType() === "article" ? "relevant" : "relevant");
  readonly urlSort = computed<any>(() => this.navService.searchParams().get("sort") || this.defaultSort());
  readonly activeSort = computed<any>(() => SORT_OPTIONS.some((option: any) => option.id === this.urlSort() && option.appliesTo.includes(this.activeType()))
    ? this.urlSort()
    : "relevant");
  readonly hasResults = computed<any>(() => this.filteredSearchResponse().total > 0);

  // --- Trạng thái (signal = useState / useRef) ---
  readonly selectedFilters = signal<any>({});
  readonly searchResponse = signal<any>(EMPTY_SEARCH_RESPONSE);
  readonly isLoading = signal<any>(true);
  readonly loadError = signal<any>("");

  constructor() {
    // URL cũ /search?q=thức ăn -> URL chuẩn SEO /tim-kiem/thuc-an (replace, giữ type/sort, giữ câu có dấu trong state)
    effect(() => {
      const { pathname } = this.navService.location();
      const legacyQuery = this.navService.searchParams().get("q")?.trim();
      if (pathname === "/search" && legacyQuery) {
        untracked(() => this.navService.navigate(
          buildSearchPath(legacyQuery, { type: this.urlType(), sort: this.navService.searchParams().get("sort") }),
          { replace: true, state: { searchQuery: legacyQuery } },
        ));
      }
    });

    // SEO: title/description/canonical theo slug; trang có bộ lọc (type/sort) -> noindex để tránh trùng lặp nội dung
    effect(() => {
      const query = this.query();
      const response = this.searchResponse();
      const hasFilterParams = Boolean(this.navService.location().search);
      untracked(() => {
        const display = response.query || query;
        this.seo.setPage({
          title: `Tìm kiếm "${display}"`,
          description: response.total
            ? `${response.total} kết quả cho "${display}" tại Dr. Pet's House: sản phẩm, dịch vụ thú cưng giá tốt.`
            : `Tìm "${display}" tại Dr. Pet's House - thức ăn, phụ kiện, dịch vụ chăm sóc thú cưng.`,
          canonicalPath: buildSearchPath(query),
          index: !hasFilterParams && response.total > 0,
        });
      });
    });
    inject(DestroyRef).onDestroy(() => this.seo.reset());

    // useEffect(..., [activeSort, activeType, query])
    effect((onCleanup: any) => {
      this.activeSort();
      this.activeType();
      this.query();
      const cleanup = untracked(() => {
        // URL cũ đang được chuyển sang slug -> chờ trang mới tìm, tránh gọi API 2 lần
        if (this.navService.location().pathname === "/search" && this.navService.searchParams().get("q")) return undefined;
        let active = true;
        this.isLoading.set(true);
        this.loadError.set("");

        this.searchApi.searchAll({ query: this.query(), type: this.activeType(), sort: this.activeSort() })
          .then((data: any) => {
            if (!active) return;
            this.searchResponse.set({
              ...EMPTY_SEARCH_RESPONSE,
              ...data,
              facets: buildFacets(data.facetCounts, data.results),
              emptyState: SEARCH_EMPTY_STATE,
            });
            this.loadCrossSell(data, () => active);
          })
          .catch(() => {
            if (!active) return;
            const fallback = mockSearchApi({ query: this.query(), type: this.activeType(), sort: this.activeSort() });
            this.searchResponse.set({
              ...EMPTY_SEARCH_RESPONSE,
              ...fallback,
              emptyState: SEARCH_EMPTY_STATE,
            });
            this.loadError.set("");
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
  }

  /** Bán chéo: điền mục "Thường được mua kèm" (results.suggestedProducts) sau khi có kết quả chính. */
  private loadCrossSell(data: any, isActive: () => boolean) {
    const products = data?.results?.products ?? [];
    if (!products.length) return;
    this.crossSell.suggest(products, { pet: data.analysis?.pet ?? null, limit: 10 })
      .then((crossSell) => {
        if (!isActive()) return;
        this.searchResponse.update((current: any) => ({
          ...current,
          crossSellServices: crossSell.services,
          results: { ...current.results, suggestedProducts: crossSell.products },
        }));
      })
      .catch(() => undefined);
  }

  protected updateParams(patch: any) {
    const next = new URLSearchParams(this.navService.searchParams());
    Object.entries(patch).forEach(([key, value]: any) => {
      if (value && !(key === "type" && value === "all") && !(key === "sort" && value === "relevant")) next.set(key, value);
      else next.delete(key);
    });
    // Giữ câu có dấu khi đổi bộ lọc (state không tự đi theo khi navigate)
    this.navService.setSearchParams(next, { state: { searchQuery: this.query() } });
  }

  protected handleTypeChange(type: any) {
    const nextSort = SORT_OPTIONS.some((option: any) => option.id === this.activeSort() && option.appliesTo.includes(type))
      ? this.activeSort()
      : "relevant";
    this.updateParams({ type, sort: nextSort });
  }

  protected handleSortChange(sort: any) {
    return this.updateParams({ sort });
  }

  protected handleRetrySearch() {
    this.selectedFilters.set({});
    const searchInput = (document.getElementById("site-search-input") as any);
    searchInput?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      searchInput?.focus();
      searchInput?.select();
    }, 250);
  }

  protected handleFilterToggle(groupId: any, optionId: any) {
    this.selectedFilters.update((current: any) => {
      const group = SEARCH_FILTER_GROUPS.find((item: any) => item.id === groupId);
      const allOptionId = group?.options.find((option: any) => option.id.startsWith("all-"))?.id;
      const values = (current as any)[groupId] || [];
      if (optionId === allOptionId) {
        return { ...current, [groupId]: [] };
      }
      const nextValues = values.includes(optionId)
        ? values.filter((value: any) => value !== optionId)
        : [...values.filter((value: any) => value !== allOptionId), optionId];
      return { ...current, [groupId]: nextValues };
    });
  }
}

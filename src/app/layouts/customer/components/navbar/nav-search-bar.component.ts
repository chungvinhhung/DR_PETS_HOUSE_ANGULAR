import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';

import { CustomerNavigationService } from '../../../../core/customer/services/customer-navigation.service';
import { SearchApiService } from '../../../../core/customer/services/api/search-api.service';
import { SearchSuggestionDropdownComponent } from './search-suggestion-dropdown.component';
import { navbarImages } from '../../../../shared/customer/assets/navbar-images';
import { getSearchSuggestions as getMockSearchSuggestions } from '../../../../shared/customer/data/search-results-data';
import { SEARCH_DEBOUNCE_MS, EMPTY_SUGGESTIONS } from './nav-search-bar.helpers';

/**
 * NavSearchBar — chuyển từ React: src/components/Navbar/NavSearchBar.jsx
 */
@Component({
  selector: 'form[app-nav-search-bar]',
  standalone: true,
  imports: [SearchSuggestionDropdownComponent],
  templateUrl: './nav-search-bar.component.html',
  host: {
    '[class]': '`web2-composite-field group relative h-[37px] w-[150px] shrink-0 xl:w-[200px] ${className()}`',
    '(submit)': 'handleSubmit($any($event))',
    '(focusout)': 'handle1($any($event))',
    '(keydown)': 'handle2($any($event))',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavSearchBarComponent {
  // --- Service dùng chung ---
  protected readonly navService = inject(CustomerNavigationService);
  protected readonly searchApi = inject(SearchApiService);

  // --- Input / Output (props của React) ---
  readonly className = input<any>("");

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly navbarImages: any = navbarImages;

  // --- Giá trị tính toán (computed) ---
  readonly suggestionItems = computed<any>(() => {
    if (!this.trimmedTerm()) return [];

    return [
      ...this.searchSuggestions().suggestions.map((suggestion: any) => ({
        id: suggestion.id,
        type: "suggestion",
        payload: suggestion,
      })),
      ...this.searchSuggestions().products.map((product: any) => ({
        id: `product-${product.id}`,
        type: "product",
        payload: product,
      })),
      {
        id: "all-results",
        type: "all-results",
        payload: { query: this.trimmedTerm() },
      },
    ];
  });
  readonly trimmedTerm = computed<any>(() => this.term().trim());
  readonly shouldShowSuggestions = computed<any>(() => this.isSuggestOpen() && this.trimmedTerm().length > 0);

  // --- Trạng thái (signal = useState / useRef) ---
  readonly term = signal<any>("");
  readonly isSuggestOpen = signal<any>(false);
  readonly searchSuggestions = signal<any>(EMPTY_SUGGESTIONS);
  readonly isLoadingSuggestions = signal<any>(false);
  readonly suggestionError = signal<any>("");
  readonly activeIndex = signal<any>(-1);

  constructor() {
    // useEffect(..., [trimmedTerm])
    effect((onCleanup: any) => {
      this.trimmedTerm();
      const cleanup = untracked(() => {
        if (!this.trimmedTerm()) {
          this.searchSuggestions.set(EMPTY_SUGGESTIONS);
          this.isLoadingSuggestions.set(false);
          this.suggestionError.set("");
          this.activeIndex.set(-1);
          return undefined;
        }

        this.isLoadingSuggestions.set(true);
        this.suggestionError.set("");
        this.activeIndex.set(-1);

        const timer = window.setTimeout(() => {
          this.searchApi.getSearchSuggestionsApi(this.trimmedTerm())
            .then((apiSuggestions: any) => {
              const fallback = getMockSearchSuggestions(this.trimmedTerm());
              this.searchSuggestions.set({
                ...apiSuggestions,
                products: fallback.products,
                total: apiSuggestions.total || fallback.total,
              });
            })
            .catch(() => {
              this.searchSuggestions.set(getMockSearchSuggestions(this.trimmedTerm()));
              this.suggestionError.set("");
            })
            .finally(() => {
              this.isLoadingSuggestions.set(false);
            });
        }, SEARCH_DEBOUNCE_MS);

        return () => window.clearTimeout(timer);
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });
  }

  protected closeSuggestions() {
    this.isSuggestOpen.set(false);
    this.activeIndex.set(-1);
  }

  protected searchByKeyword(keyword: any) {
    const query = keyword.trim();
    this.closeSuggestions();
    this.navService.navigate(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
  }

  protected openProduct(product: any) {
    this.closeSuggestions();
    this.navService.navigate(product.href);
  }

  protected selectSuggestion(suggestion: any) {
    this.term.set(suggestion.label);
    this.searchByKeyword(suggestion.label);
  }

  protected openActiveItem() {
    const activeItem = (this.suggestionItems() as any)[this.activeIndex()];
    if (!activeItem) return false;

    if (activeItem.type === "suggestion") {
      this.selectSuggestion(activeItem.payload);
      return true;
    }

    if (activeItem.type === "product") {
      this.openProduct(activeItem.payload);
      return true;
    }

    this.searchByKeyword(this.trimmedTerm());
    return true;
  }

  protected handleSubmit(event: any) {
    event.preventDefault();
    this.searchByKeyword(this.term());
  }

  protected handle1(event: any) {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    window.setTimeout(this.closeSuggestions.bind(this), 100);
  }

  protected handle2(event: any) {
    if (!this.shouldShowSuggestions()) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      this.activeIndex.update((current: any) => (current + 1) % Math.max(this.suggestionItems().length, 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      this.activeIndex.update((current: any) => (
        current <= 0 ? Math.max(this.suggestionItems().length - 1, -1) : current - 1
      ));
      return;
    }

    if (event.key === "Enter" && this.activeIndex() >= 0) {
      event.preventDefault();
      this.openActiveItem();
      return;
    }

    if (event.key === "Escape") {
      this.closeSuggestions();
    }
  }

  protected handle3(event: any) {
    this.term.set(event.target.value);
    this.isSuggestOpen.set(event.target.value.trim().length > 0);
  }

  protected handle4() {
    this.term.set("");
    this.searchSuggestions.set(EMPTY_SUGGESTIONS);
    this.closeSuggestions();
    (document.getElementById("site-search-input") as any)?.focus();
  }

  protected handle5(itemId: any) {
    const nextIndex = this.suggestionItems().findIndex((item: any) => item.id === itemId);
    this.activeIndex.set(nextIndex);
  }
}

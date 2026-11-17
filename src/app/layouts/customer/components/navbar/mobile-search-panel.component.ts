import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import { CustomerNavigationService } from '../../../../core/customer/services/customer-navigation.service';
import { SearchApiService } from '../../../../core/customer/services/api/search-api.service';
import { SearchAssetIconComponent } from './search-asset-icon.component';
import { CustomerIconComponent } from '../../../../shared/customer/components/icon/customer-icon.component';
import { navbarImages } from '../../../../shared/customer/assets/navbar-images';
import { getSearchSuggestions as getMockSearchSuggestions } from '../../../../shared/customer/data/search-results-data';
import { buildSearchPath } from '../../../../shared/customer/utils/slug';
import { formatVnd } from '../../../../shared/customer/utils/currency';
import { SEARCH_DEBOUNCE_MS, EMPTY_SUGGESTIONS } from './mobile-nav-bar.helpers';

/**
 * MobileSearchPanel — chuyển từ React: src/components/Navbar/MobileNavBar.jsx
 */
@Component({
  selector: 'app-mobile-search-panel',
  standalone: true,
  imports: [SearchAssetIconComponent, CustomerIconComponent],
  templateUrl: './mobile-search-panel.component.html',
  styleUrl: './mobile-search-panel.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileSearchPanelComponent {
  // --- Service dùng chung ---
  protected readonly navService = inject(CustomerNavigationService);
  protected readonly searchApi = inject(SearchApiService);

  // --- Input / Output (props của React) ---
  readonly open = input<any>(undefined);
  readonly onClose = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly navbarImages: any = navbarImages;
  protected readonly formatVnd: any = formatVnd;

  // --- Giá trị tính toán (computed) ---
  readonly query = computed<any>(() => this.term().trim());
  readonly visibleSuggestions = computed<any>(() => this.query() ? this.suggestions().suggestions : this.defaultSuggestions().suggestions);
  readonly visibleProducts = computed<any>(() => this.query() ? this.suggestions().products : this.defaultSuggestions().products);
  readonly displayQuery = computed<any>(() => this.query() || "tắm");

  // --- Trạng thái (signal = useState / useRef) ---
  readonly term = signal<any>("");
  readonly suggestions = signal<any>(EMPTY_SUGGESTIONS);
  readonly defaultSuggestions = signal<any>((() => getMockSearchSuggestions("tắm"))());
  readonly isLoading = signal<any>(false);
  readonly error = signal<any>("");

  constructor() {
    // useEffect(..., [onClose, open])
    effect((onCleanup: any) => {
      this.open();
      const cleanup = untracked(() => {
        if (!this.open()) return undefined;
        this.searchApi.getSearchSuggestionsApi("tắm")
          .then((apiSuggestions: any) => {
            this.defaultSuggestions.set(apiSuggestions);
          })
          .catch(() => this.defaultSuggestions.set(getMockSearchSuggestions("tắm")));

        const handleKeyDown = (event: any) => {
          if (event.key === "Escape") this.onClose.emit(undefined);
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });

    // useEffect(..., [query])
    effect((onCleanup: any) => {
      this.query();
      const cleanup = untracked(() => {
        if (!this.query()) {
          this.suggestions.set(EMPTY_SUGGESTIONS);
          this.isLoading.set(false);
          this.error.set("");
          return undefined;
        }

        this.isLoading.set(true);
        this.error.set("");
        const timer = window.setTimeout(() => {
          this.searchApi.getSearchSuggestionsApi(this.query())
            .then((apiSuggestions: any) => {
                this.suggestions.set(apiSuggestions);
            })
            .catch(() => {
              this.suggestions.set(getMockSearchSuggestions(this.query()));
              this.error.set("");
            })
            .finally(() => {
              this.isLoading.set(false);
            });
        }, SEARCH_DEBOUNCE_MS);

        return () => window.clearTimeout(timer);
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });
  }

  protected searchByKeyword(keyword: any) {
    const nextQuery = keyword.trim();
    this.onClose.emit(undefined);
    this.navService.navigate(buildSearchPath(nextQuery), { state: { searchQuery: nextQuery } });
  }

  protected handle1(event: any) {
    event.preventDefault();
    this.searchByKeyword(this.term());
  }

  protected handle2(product: any) {
    this.onClose.emit(undefined);
    this.navService.navigate(product.href);
  }
}

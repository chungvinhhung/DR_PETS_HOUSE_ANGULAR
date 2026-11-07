import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, input, signal, untracked, viewChild, OnInit } from '@angular/core';

import { CustomerNavigationService } from '../../../../../core/customer/services/customer-navigation.service';
import { CartService } from '../../../../../core/customer/services/cart.service';
import { ProductApiService } from '../../../../../core/customer/services/api/product-api.service';
import { CanvasLayoutComponent } from '../../../../../shared/customer/components/canvas-layout/canvas-layout.component';
import { NavBarComponent } from '../../../../../layouts/customer/components/navbar/nav-bar.component';
import { BreadcrumbComponent } from '../../../../../shared/customer/components/breadcrumb/breadcrumb.component';
import { ProductRatingComponent } from '../../../../../shared/customer/components/product-rating/product-rating.component';
import { WriteReviewFormComponent } from '../../components/write-review-form.component';
import { ShoppingProductCardComponent } from '../../../../../shared/customer/components/shopping-product-card/shopping-product-card.component';
import { FooterComponent } from '../../../../../layouts/customer/components/footer/footer.component';
import { ReactStyleDirective } from '../../../../../shared/customer/directives/react-style.directive';
import { CustomerLinkDirective } from '../../../../../shared/customer/directives/customer-link.directive';
import { productImages } from '../../../../../shared/customer/assets/product-images';
import { normalizeArray } from '../../../../../core/customer/services/api/product-api.service';
import { FEATURED_PRODUCTS } from '../../../../../shared/customer/data/shop-data';
import { REVIEW_PAGE_SIZE, EMPTY_REVIEWS_DATA, buildFallbackProduct, findFallbackProduct, formatPrice, formatReviewTime, normalizeReviewsData } from './product-details-page.helpers';

/**
 * ProductDetailsPage — chuyển từ React: src/pages/Product/ProductDetailsPage.jsx
 */
@Component({
  selector: 'app-product-details-page',
  standalone: true,
  imports: [CanvasLayoutComponent, NavBarComponent, BreadcrumbComponent, ProductRatingComponent, WriteReviewFormComponent, ShoppingProductCardComponent, FooterComponent, ReactStyleDirective, CustomerLinkDirective],
  templateUrl: './product-details-page.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailsPageComponent implements OnInit {
  // --- Service dùng chung ---
  protected readonly navService = inject(CustomerNavigationService);
  protected readonly cartService = inject(CartService);
  protected readonly productApi = inject(ProductApiService);
  private readonly destroyRef = inject(DestroyRef);

  // --- Input / Output (props của React) ---
  readonly showWriteReview = input<any>(false);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly formatPrice: any = formatPrice;
  protected readonly productImages: any = productImages;
  protected readonly formatReviewTime: any = formatReviewTime;

  // --- Giá trị tính toán (computed) ---
  readonly thumbnails = computed<any>(() => this.product()?.images?.length ? this.product().images : [productImages.detailImage]);
  readonly selectedImage = computed<any>(() => (this.thumbnails() as any)[this.selectedImageIdx()] || this.thumbnails()[0]);
  readonly totalReviewPages = computed<any>(() => this.reviewsData().totalPages || 1);
  readonly reviewItems = computed<any>(() => Array.isArray(this.reviewsData().items) ? this.reviewsData().items : []);
  readonly SIM_CARD_WIDTH = computed<any>(() => 170);
  readonly SIM_CARD_GAP = computed<any>(() => 20);
  readonly SIM_VISIBLE_COUNT = computed<any>(() => 6);
  readonly safeSimilarProducts = computed<any>(() => Array.isArray(this.similarProducts()) ? this.similarProducts() : []);
  readonly canGoSimPrev = computed<any>(() => this.simOffset() > 0);
  readonly canGoSimNext = computed<any>(() => this.simOffset() < this.safeSimilarProducts().length - Number(this.SIM_VISIBLE_COUNT()));
  readonly selectedVariant = computed<any>(() => this.product().variants?.[this.selectedTypeIdx()]);
  readonly dropdownOptions = computed<any>(() => this.selectedVariant()?.sizes ?? []);

  // --- Trạng thái (signal = useState / useRef) ---
  readonly product = signal<any>(null);
  readonly reviewsData = signal<any>(EMPTY_REVIEWS_DATA);
  readonly similarProducts = signal<any>([]);
  readonly isLoading = signal<any>(true);
  readonly loadError = signal<any>("");
  readonly selectedImageIdx = signal<any>(0);
  readonly thumbHovered = signal<any>(null);
  readonly selectedTypeIdx = signal<any>(0);
  readonly dropdownOpen = signal<any>(false);
  readonly dropdownValue = signal<any>("");
  readonly quantity = signal<any>(1);
  readonly reviewPage = signal<any>(1);
  readonly likedReviews = signal<any>({});
  readonly isReviewTab = signal<any>(undefined);
  readonly tabTransitioning = signal<any>(false);
  readonly cartAdded = signal<any>(false);
  readonly simOffset = signal<any>(0);
  readonly descriptionRef = viewChild<ElementRef<any>>('descriptionRef');
  readonly dropdownRef = viewChild<ElementRef<any>>('dropdownRef');
  readonly tabSectionRef = viewChild<ElementRef<any>>('tabSectionRef');

  constructor() {
    // useEffect(..., [productId])
    effect((onCleanup: any) => {
      this.navService.params()['productId'];
      const cleanup = untracked(() => {
        if (!this.navService.params()['productId']) {
          this.loadError.set("Thiếu mã sản phẩm.");
          this.isLoading.set(false);
          return;
        }

        let active = true;
        this.isLoading.set(true);
        this.loadError.set("");

        this.productApi.getProductDetails(this.navService.params()['productId'])
          .then((detail: any) => {
            if (!active) return;
            this.product.set(detail);
            const firstSize = detail?.variants?.[0]?.sizes?.[0] ?? "";
            this.dropdownValue.set(firstSize);
            this.productApi.getSimilarProducts(this.navService.params()['productId']).then((similar: any) => {
              if (active) this.similarProducts.set(normalizeArray(similar));
            });
          })
          .catch(() => {
            if (active) {
              const fallbackProduct = buildFallbackProduct(findFallbackProduct(this.navService.params()['productId']));
              this.product.set(fallbackProduct);
              this.similarProducts.set(FEATURED_PRODUCTS.filter((item: any) => String(item.id) !== String(this.navService.params()['productId'])).map(buildFallbackProduct));
              this.loadError.set(fallbackProduct ? "Không thể tải thông tin sản phẩm, đang hiển thị dữ liệu mẫu." : "Không thể tải thông tin sản phẩm.");
            }
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

    // useEffect(..., [productId, reviewPage])
    effect((onCleanup: any) => {
      this.navService.params()['productId'];
      this.reviewPage();
      const cleanup = untracked(() => {
        if (!this.navService.params()['productId']) return;
        let active = true;
        this.productApi.getProductReviews(this.navService.params()['productId'], this.reviewPage(), REVIEW_PAGE_SIZE)
          .then((data: any) => {
            if (active) this.reviewsData.set(normalizeReviewsData(data));
          })
          .catch(() => {
            if (active) this.reviewsData.set(EMPTY_REVIEWS_DATA);
          });
        return () => {
          active = false;
        };
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });

    // useEffect(..., [productId])
    effect((onCleanup: any) => {
      this.navService.params()['productId'];
      const cleanup = untracked(() => {
        this.selectedImageIdx.set(0);
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });

    // useEffect(..., []) -> chạy 1 lần sau khi render
    afterNextRender(() => {
      const cleanup = (() => {
        const handleClickOutside = (e: any) => {
          if (this.dropdownRef()?.nativeElement && !this.dropdownRef()?.nativeElement.contains(e.target)) {
            this.dropdownOpen.set(false);
          }
        };
        const handleKeyDown = (e: any) => {
          if (e.key === "Escape") this.dropdownOpen.set(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
          document.removeEventListener("mousedown", handleClickOutside);
          document.removeEventListener("keydown", handleKeyDown);
        };
      })();
      if (typeof cleanup === 'function') this.destroyRef.onDestroy(cleanup);
    });
  }

  ngOnInit(): void {
    this.isReviewTab.set(this.showWriteReview());
  }

  protected async handleLike(reviewId: any) {
    if (!this.navService.params()['productId']) return;
    try {
      await this.productApi.likeProductReview(this.navService.params()['productId'], reviewId);
    } catch {
      return;
    }
    this.likedReviews.update((prev: any) => {
      const isLiked = !!(prev as any)[`_${reviewId}`];
      return {
        ...prev,
        [reviewId]: isLiked ? (prev as any)[reviewId] - 1 : ((prev as any)[reviewId] || 0) + 1,
        [`_${reviewId}`]: !isLiked,
      };
    });
  }

  protected scrollToTabSection() {
    this.tabSectionRef()?.nativeElement?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  protected handleTabMota() {
    if (this.isReviewTab()) {
      this.tabTransitioning.set(true);
      setTimeout(() => {
        this.isReviewTab.set(false);
        this.scrollToTabSection();
        setTimeout(() => this.tabTransitioning.set(false), 50);
      }, 150);
    } else {
      this.scrollToTabSection();
    }
  }

  protected handleTabDanhGia() {
    if (!this.isReviewTab()) {
      this.tabTransitioning.set(true);
      setTimeout(() => {
        this.isReviewTab.set(true);
        this.scrollToTabSection();
        setTimeout(() => this.tabTransitioning.set(false), 50);
      }, 150);
    } else {
      this.scrollToTabSection();
    }
  }

  protected handleReadMore() {
    if (this.isReviewTab()) {
      this.isReviewTab.set(false);
    }
    setTimeout(() => {
      (this.descriptionRef()?.nativeElement || this.tabSectionRef()?.nativeElement)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  protected handleDecrement() {
    return this.quantity.update((q: any) => Math.max(1, q - 1));
  }

  protected handleIncrement() {
    return this.quantity.update((q: any) => q + 1);
  }

  protected handleAddToCart() {
    const variant = this.product()?.variants?.[this.selectedTypeIdx()];
    const itemPrice = variant?.price ?? this.product().price;
    this.cartService.addToCart({
      id: `${this.product().id}:${variant?.id ?? "default"}:${this.dropdownValue() || "default"}`,
      productId: this.product().id,
      variantId: variant?.id ?? null,
      name: this.product().name,
      price: itemPrice,
      image: this.selectedImage(),
      type: variant?.name,
      size: this.dropdownValue(),
      variants: this.product().variants,
      qty: this.quantity(),
    });
    this.cartService.openCart();
    this.cartAdded.set(true);
    setTimeout(() => this.cartAdded.set(false), 1800);
  }

  protected handleBuyNow() {
    const variant = this.product()?.variants?.[this.selectedTypeIdx()];
    const itemPrice = variant?.price ?? this.product().price;
    this.cartService.addToCart({
      id: `${this.product().id}:${variant?.id ?? "default"}:${this.dropdownValue() || "default"}`,
      productId: this.product().id,
      variantId: variant?.id ?? null,
      name: this.product().name,
      price: itemPrice,
      image: this.selectedImage(),
      type: variant?.name,
      size: this.dropdownValue(),
      variants: this.product().variants,
      qty: this.quantity(),
    });
    this.cartService.openCheckout();
  }

  protected handleReviewPage(page: any) {
    this.reviewPage.set(page);
    this.tabSectionRef()?.nativeElement?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  protected handleSimPrev() {
    if (!this.canGoSimPrev()) return;
    this.simOffset.update((offset: any) => offset - 1);
  }

  protected handleSimNext() {
    if (!this.canGoSimNext()) return;
    this.simOffset.update((offset: any) => offset + 1);
  }

  protected getPageNumbers() {
    const pages: any = [];
    const total = this.totalReviewPages();
    const current = this.reviewPage();
    if (total <= 5) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      if (current <= 3) {
        pages.push(1, 2, 3, 4, "...", total);
      } else if (current >= total - 2) {
        pages.push(1, "...", total - 3, total - 2, total - 1, total);
      } else {
        pages.push(1, "...", current - 1, current, current + 1, "...", total);
      }
    }
    return pages;
  }

  protected async handleReviewSubmit({ rating, review }: any) {
    await this.productApi.createProductReview(this.navService.params()['productId'], { rating, content: review });
    const updated = await this.productApi.getProductReviews(this.navService.params()['productId'], 1, REVIEW_PAGE_SIZE);
    this.reviewPage.set(1);
    this.reviewsData.set(normalizeReviewsData(updated));
  }

  /** (tự sinh) global Math không dùng trực tiếp được trong template */
  protected compute1(): any {
    return this.product().discountPercent || Math.round((1 - this.product().price / this.product().originalPrice) * 100);
  }

  protected handle2(i: any, variant: any) {
    this.selectedTypeIdx.set(i);
    this.dropdownValue.set(variant.sizes?.[0] ?? "");
  }

  protected handle3() {
    this.dropdownOpen.update((o: any) => !o);
  }

  protected handle4(opt: any) {
    this.dropdownValue.set(opt);
    this.dropdownOpen.set(false);
  }

  /** (tự sinh) global Math không dùng trực tiếp được trong template */
  protected styles5(value: any): any {
    return { width: `${Math.min(100, this.reviewsData().ratingBreakdown?.[value] || 0) * 1.68}px` };
  }

  protected handle6() {
    this.handleReviewPage(Math.max(1, Number(this.reviewPage()) - 1));
  }

  protected handle7() {
    this.handleReviewPage(Math.min(this.totalReviewPages(), this.reviewPage() + 1));
  }
}

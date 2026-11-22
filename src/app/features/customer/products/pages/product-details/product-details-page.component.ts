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
import { YellowButtonComponent } from '../../../../../shared/customer/components/yellow-button/yellow-button.component';
import { SeoService, buildProductJsonLd } from '../../../../../core/customer/services/seo.service';
import { buildProductPath, extractProductId } from '../../../../../shared/customer/utils/slug';

/**
 * ProductDetailsPage — chuyển từ React: src/pages/Product/ProductDetailsPage.jsx
 */
@Component({
  selector: 'app-product-details-page',
  standalone: true,
  imports: [CanvasLayoutComponent, NavBarComponent, BreadcrumbComponent, ProductRatingComponent, WriteReviewFormComponent, ShoppingProductCardComponent, FooterComponent, ReactStyleDirective, CustomerLinkDirective, YellowButtonComponent],
  templateUrl: './product-details-page.component.html',
  styleUrl: './product-details-page.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailsPageComponent implements OnInit {
  // --- Service dùng chung ---
  protected readonly navService = inject(CustomerNavigationService);
  protected readonly cartService = inject(CartService);
  protected readonly productApi = inject(ProductApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly seo = inject(SeoService);

  // --- Input / Output (props của React) ---
  readonly showWriteReview = input<any>(false);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly formatPrice: any = formatPrice;
  protected readonly productImages: any = productImages;
  protected readonly formatReviewTime: any = formatReviewTime;


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
  readonly notifyEmail = signal<string>('');
  readonly notifySubscribed = signal<boolean>(false);
  readonly notifyError = signal<string>('');

  readonly descriptionRef = viewChild<ElementRef<any>>('descriptionRef');
  readonly thumbnailsRef = viewChild<ElementRef<HTMLElement>>('thumbnailsRef');
  readonly dropdownRef = viewChild<ElementRef<any>>('dropdownRef');
  readonly tabSectionRef = viewChild<ElementRef<any>>('tabSectionRef');
  readonly similarSectionRef = viewChild<ElementRef<any>>('similarSectionRef');

  // --- Giá trị tính toán (computed) ---
  /** Id sản phẩm lấy từ slug /san-pham/<ten>-i.<id> hoặc URL cũ /product-details/<id> */
  readonly productId = computed<string>(() => {
    const params = this.navService.params();
    return extractProductId(params['productSlug'] ?? params['productId']);
  });
  /** Ảnh cột trái: mỗi biến thể 1 ảnh đại diện (xếp đầu), sau đó là ảnh mô tả chung (cuộn xuống để xem). */
  readonly galleryItems = computed<{ src: string; variantIdx: number | null; label?: string }[]>(() => {
    const product = this.product();
    const variantItems = this.hasMultipleVariants()
      ? (product?.variants ?? [])
          .map((variant: any, i: number) => ({ src: variant?.image || product?.image, variantIdx: i, label: variant?.label || variant?.name }))
          .filter((item: any) => item.label && item.src)
      : [];
    const variantSrcs = new Set(variantItems.map((item: any) => item.src));
    const generalItems = (product?.images ?? [])
      .filter((src: string) => src && !variantSrcs.has(src))
      .map((src: string) => ({ src, variantIdx: null }));
    const items = [...variantItems, ...generalItems];
    return items.length ? items : [{ src: productImages.detailImage, variantIdx: null }];
  });
  readonly selectedImage = computed<any>(() => (this.galleryItems()[this.selectedImageIdx()] ?? this.galleryItems()[0]).src);
  readonly totalReviewPages = computed<any>(() => this.reviewsData().totalPages || 1);
  readonly reviewItems = computed<any>(() => Array.isArray(this.reviewsData().items) ? this.reviewsData().items : []);
  readonly SIM_CARD_WIDTH = computed<any>(() => 170);
  readonly SIM_CARD_GAP = computed<any>(() => 20);
  /** Số thẻ "Sản phẩm tương tự" hiển thị cùng lúc — đổi theo chiều rộng màn hình (fluid layout). */
  private readonly viewportWidth = signal<number>(typeof window === 'undefined' ? 1440 : window.innerWidth);
  readonly SIM_VISIBLE_COUNT = computed<any>(() => {
    const width = this.viewportWidth();
    return Math.max(1, Math.min(6, Math.floor((width - 200) / (this.SIM_CARD_WIDTH() + this.SIM_CARD_GAP()))));
  });
  readonly safeSimilarProducts = computed<any>(() => Array.isArray(this.similarProducts()) ? this.similarProducts() : []);
  readonly canGoSimPrev = computed<any>(() => this.simOffset() > 0);
  readonly canGoSimNext = computed<any>(() => this.simOffset() < this.safeSimilarProducts().length - Number(this.SIM_VISIBLE_COUNT()));
  readonly selectedVariant = computed<any>(() => this.product()?.variants?.[this.selectedTypeIdx()]);
  readonly dropdownOptions = computed<any>(() => this.selectedVariant()?.sizes ?? []);

  readonly hasMultipleVariants = computed<boolean>(() => {
    const variants = this.product()?.variants;
    if (!variants || !variants.length) return false;
    if (variants.length > 1) return true;
    const single = variants[0];
    return !!single?.label && single.label !== 'Mặc định' && single.label !== 'Tiêu chuẩn';
  });

  readonly currentPrice = computed<number>(() => {
    const variant = this.selectedVariant();
    if (variant && variant.price !== undefined && variant.price !== null) {
      return Number(variant.price);
    }
    return Number(this.product()?.price ?? 0);
  });

  readonly currentOriginalPrice = computed<number | undefined>(() => {
    const variant = this.selectedVariant();
    if (variant) {
      return variant.originalPrice && Number(variant.originalPrice) > this.currentPrice()
        ? Number(variant.originalPrice)
        : undefined;
    }
    return this.product()?.originalPrice ? Number(this.product().originalPrice) : undefined;
  });

  readonly currentDiscountPercent = computed<number | undefined>(() => {
    const variant = this.selectedVariant();
    if (variant) {
      if (variant.discountPercent !== undefined && variant.discountPercent !== null && Number(variant.discountPercent) > 0) {
        return Number(variant.discountPercent);
      }
      const price = this.currentPrice();
      const orig = this.currentOriginalPrice();
      if (orig && orig > price && price > 0) {
        return Math.round(((orig - price) / orig) * 100);
      }
      return undefined;
    }
    return this.product()?.discountPercent ? Number(this.product().discountPercent) : undefined;
  });

  readonly currentStock = computed<number>(() => {
    const variant = this.selectedVariant();
    if (variant) {
      const stock = variant.availableStock ?? variant.stockQuantity;
      if (stock !== undefined && stock !== null) {
        return Number(stock);
      }
    }
    const prodStock = this.product()?.totalStock ?? this.product()?.stockQuantity ?? this.product()?.availableStock;
    return prodStock !== undefined && prodStock !== null ? Number(prodStock) : 0;
  });

  readonly isOutOfStock = computed<boolean>(() => {
  const variant = this.selectedVariant();
  // Nếu có biến thể đang chọn, chỉ xét tồn kho của chính biến thể đó
  if (variant) {
    return this.currentStock() <= 0;
  }
  if (this.product()?.outOfStock) return true;
  return this.currentStock() <= 0;
});


  constructor() {
    // useEffect(..., [productId])
    effect((onCleanup: any) => {
      this.productId();
      const cleanup = untracked(() => {
        if (!this.productId()) {
          this.loadError.set("Thiếu mã sản phẩm.");
          this.isLoading.set(false);
          return;
        }

        let active = true;
        this.isLoading.set(true);
        this.loadError.set("");
        this.selectedTypeIdx.set(0);
        this.notifySubscribed.set(false);
        this.notifyEmail.set('');
        this.notifyError.set('');

        this.productApi.getProductDetails(this.productId())
          .then((detail: any) => {
            if (!active) return;
            this.product.set(detail);
            this.applySeo(detail);
            const firstSize = detail?.variants?.[0]?.sizes?.[0] ?? "";
            this.dropdownValue.set(firstSize);
            this.productApi.getSimilarProducts(this.productId()).then((similar: any) => {
              if (active) this.similarProducts.set(normalizeArray(similar));
            });
          })
          .catch(() => {
            if (active) {
              const fallbackProduct = buildFallbackProduct(findFallbackProduct(this.productId()));
              this.product.set(fallbackProduct);
              this.similarProducts.set(FEATURED_PRODUCTS.filter((item: any) => String(item.id) !== String(this.productId())).map(buildFallbackProduct));
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
      this.productId();
      this.reviewPage();
      const cleanup = untracked(() => {
        if (!this.productId()) return;
        let active = true;
        this.productApi.getProductReviews(this.productId(), this.reviewPage(), REVIEW_PAGE_SIZE)
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
      this.productId();
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
        const handleResize = () => this.viewportWidth.set(window.innerWidth);
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("keydown", handleKeyDown);
        window.addEventListener("resize", handleResize);
        return () => {
          window.removeEventListener("resize", handleResize);
          document.removeEventListener("mousedown", handleClickOutside);
          document.removeEventListener("keydown", handleKeyDown);
        };
      })();
      if (typeof cleanup === 'function') this.destroyRef.onDestroy(cleanup);
    });
  }

  ngOnInit(): void {
    this.isReviewTab.set(this.showWriteReview());
    this.destroyRef.onDestroy(() => this.seo.reset());
  }

  /**
   * SEO cho trang chi tiết: title/description/canonical/JSON-LD Product.
   * Nếu URL đang mở khác URL chuẩn (URL cũ theo id, hoặc tên sản phẩm đã đổi) -> thay URL tại chỗ
   * (replaceUrl, không tải lại trang) để người dùng và công cụ tìm kiếm chỉ thấy 1 địa chỉ duy nhất.
   */
  private applySeo(detail: any) {
    const canonicalPath = buildProductPath(detail);
    const canonicalUrl = new URL(canonicalPath, window.location.origin).toString();
    this.seo.setPage({
      title: detail?.categoryName ? `${detail.name} - ${detail.categoryName}` : detail?.name || 'Sản phẩm',
      description: detail?.description,
      canonicalPath,
      image: detail?.image,
      type: 'product',
      jsonLd: buildProductJsonLd(detail, canonicalUrl),
    });

    const { pathname, search, hash } = this.navService.location();
    if (!this.showWriteReview() && detail?.id && pathname !== canonicalPath) {
      this.navService.navigate(`${canonicalPath}${search}${hash}`, { replace: true });
    }
  }

  protected selectVariant(i: number, variant: any) {
  this.selectedTypeIdx.set(i);
  this.dropdownValue.set(variant?.sizes?.[0] ?? "");
  const thumbIdx = this.galleryItems().findIndex((item) => item.variantIdx === i);
  if (thumbIdx !== -1) {
    this.selectedImageIdx.set(thumbIdx);
    this.scrollThumbnailIntoView(thumbIdx);
  }

  const stock = Number(variant?.availableStock ?? variant?.stockQuantity ?? 0);
  if (stock <= 0) {
    this.quantity.set(1);
  } else if (this.quantity() > stock) {
    this.quantity.set(stock);
  }
}


  /** Bấm ảnh đại diện biến thể -> chọn luôn biến thể đó bên phải; ảnh chung chỉ đổi ảnh lớn. */
  protected selectThumbnail(i: number) {
    this.selectedImageIdx.set(i);
    const variantIdx = this.galleryItems()[i]?.variantIdx;
    if (variantIdx !== null && variantIdx !== undefined && variantIdx !== this.selectedTypeIdx()) {
      this.selectVariant(variantIdx, this.product()?.variants?.[variantIdx]);
    }
  }

  /** Cuộn riêng cột ảnh nhỏ (không cuộn cả trang) để ảnh thứ i lọt vào khung 3 ô. */
  private scrollThumbnailIntoView(i: number) {
    const container = this.thumbnailsRef()?.nativeElement;
    const thumb = container?.children[i] as HTMLElement | undefined;
    if (!container || !thumb) return;
    const top = thumb.offsetTop;
    const bottom = top + thumb.offsetHeight;
    if (top < container.scrollTop) {
      container.scrollTo({ top, behavior: 'smooth' });
    } else if (bottom > container.scrollTop + container.clientHeight) {
      container.scrollTo({ top: bottom - container.clientHeight, behavior: 'smooth' });
    }
  }

  protected async handleLike(reviewId: any) {
    if (!this.productId()) return;
    try {
      await this.productApi.likeProductReview(this.productId(), reviewId);
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
    this.isReviewTab.set(false);
    window.requestAnimationFrame(() => {
      this.scrollToTabSection();
    });
  }

  protected handleDecrement() {
    return this.quantity.update((q: any) => Math.max(1, q - 1));
  }

  protected handleIncrement() {
    const maxStock = this.currentStock();
    if (maxStock > 0 && this.quantity() >= maxStock) {
      return;
    }
    return this.quantity.update((q: any) => q + 1);
  }

  protected handleAddToCart() {
    if (this.isOutOfStock()) return;
    const variant = this.selectedVariant();
    const itemPrice = this.currentPrice();
    this.cartService.addToCart({
      id: `${this.product().id}:${variant?.id ?? "default"}:${this.dropdownValue() || "default"}`,
      productId: this.product().id,
      variantId: variant?.id ?? null,
      name: this.product().name,
      price: itemPrice,
      image: this.selectedImage(),
      type: variant?.label || variant?.name || 'Mặc định',
      size: this.dropdownValue(),
      variants: this.product().variants,
      qty: this.quantity(),
    });
    this.cartService.openCart();
    this.cartAdded.set(true);
    setTimeout(() => this.cartAdded.set(false), 1800);
  }

  protected handleBuyNow() {
    if (this.isOutOfStock()) return;
    const variant = this.selectedVariant();
    const itemPrice = this.currentPrice();
    this.cartService.addToCart({
      id: `${this.product().id}:${variant?.id ?? "default"}:${this.dropdownValue() || "default"}`,
      productId: this.product().id,
      variantId: variant?.id ?? null,
      name: this.product().name,
      price: itemPrice,
      image: this.selectedImage(),
      type: variant?.label || variant?.name || 'Mặc định',
      size: this.dropdownValue(),
      variants: this.product().variants,
      qty: this.quantity(),
    });
    this.cartService.openCheckout();
  }

  protected handleSubscribeNotify() {
    const email = this.notifyEmail().trim();
    if (!email || !email.includes('@')) {
      this.notifyError.set('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }
    this.notifyError.set('');
    this.notifySubscribed.set(true);
  }

  protected handleFindSimilar() {
    if (this.similarSectionRef()?.nativeElement) {
      this.similarSectionRef()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      this.navService.navigate('/products');
    }
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
    try {
      await this.productApi.createProductReview(this.productId(), { rating, content: review });
      const updated = await this.productApi.getProductReviews(this.productId(), 1, REVIEW_PAGE_SIZE);
      this.reviewPage.set(1);
      this.reviewsData.set(normalizeReviewsData(updated));
      alert("Cảm ơn bạn đã gửi đánh giá sản phẩm thành công!");
    } catch (err: any) {
      alert(err?.message || "Không thể gửi đánh giá. Vui lòng thử lại sau.");
    }
  }

  /** (tự sinh) global Math không dùng trực tiếp được trong template */
  protected compute1(): any {
    return this.currentDiscountPercent() ?? this.product()?.discountPercent ?? 0;
  }

  protected handle2(i: any, variant: any) {
    this.selectVariant(i, variant);
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

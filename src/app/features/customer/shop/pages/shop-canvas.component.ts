import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, effect, inject, signal, untracked } from '@angular/core';

import { CustomerNavigationService } from '../../../../core/customer/services/customer-navigation.service';
import { ProductApiService } from '../../../../core/customer/services/api/product-api.service';
import { ShopHeroSectionComponent } from '../components/shop-hero-section.component';
import { ShoppingProductCardComponent } from '../../../../shared/customer/components/shopping-product-card/shopping-product-card.component';
import { FeedbackSectionComponent } from '../../../../shared/customer/components/feedback-section/feedback-section.component';
import { ReactStyleDirective } from '../../../../shared/customer/directives/react-style.directive';
import { shopImages } from '../../../../shared/customer/assets/shop-images';
import { FEATURED_PRODUCTS, PRODUCT_CATEGORIES, SHOP_PRODUCTS, SHOP_PROMOTION_PAGES } from '../../../../shared/customer/data/shop-data';
import { SECTION_TITLE_TYPOGRAPHY, getFallbackFlashSaleEndTime, getFlashSaleCountdownTarget, getRemainingTimeParts } from './shop-page.helpers';

/**
 * ShopCanvas — chuyển từ React: src/pages/Shop/ShopPage.jsx
 */
@Component({
  selector: 'main[app-shop-canvas]',
  standalone: true,
  imports: [ShopHeroSectionComponent, ShoppingProductCardComponent, FeedbackSectionComponent, ReactStyleDirective],
  templateUrl: './shop-canvas.component.html',
  styleUrl: './shop-canvas.component.scss',
  host: {
    'class': 'relative h-[calc(3346px+0.5cm)] w-[1440px] bg-white',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopCanvasComponent {
  // --- Service dùng chung ---
  protected readonly navService = inject(CustomerNavigationService);
  protected readonly productApi = inject(ProductApiService);
  private readonly destroyRef = inject(DestroyRef);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly PRODUCT_CATEGORIES: any = PRODUCT_CATEGORIES;
  protected readonly shopImages: any = shopImages;
  protected readonly SHOP_PROMOTION_PAGES: any = SHOP_PROMOTION_PAGES;

  // --- Giá trị tính toán (computed) ---
  readonly CARD_WIDTH = computed<any>(() => 170);
  readonly CARD_GAP = computed<any>(() => 20);
  readonly VISIBLE_COUNT = computed<any>(() => 6);
  readonly discountedBestSellers = computed<any>(() => this.bestSellerProducts().filter((product: any) => product.discountPercent));
  readonly flashDisplayProducts = computed<any>(() => this.flashProducts().length
    ? this.flashProducts()
    : (this.discountedBestSellers().length ? this.discountedBestSellers() : this.bestSellerProducts()).slice(0, 12));
  readonly canGoPrev = computed<any>(() => this.flashOffset() > 0);
  readonly canGoNext = computed<any>(() => this.flashOffset() < Math.max(this.flashDisplayProducts().length - Number(this.VISIBLE_COUNT()), 0));
  readonly currentPromoPage = computed<any>(() => (SHOP_PROMOTION_PAGES as any)[this.promotionPageIndex()]);
  private readonly __d1 = computed<any>(() => this.currentPromoPage());
  readonly leftPromotion = computed<any>(() => this.__d1()[0]);
  readonly rightPromotion = computed<any>(() => this.__d1()[1]);
  readonly promoSlideClass = computed<any>(() => this.promoDirection() === 0 ? "translate-x-0" : this.promoDirection() > 0 ? "animate-feedback-in-next" : "animate-feedback-in-prev");

  // --- Trạng thái (signal = useState / useRef) ---
  readonly flashOffset = signal<any>(0);
  readonly flashProducts = signal<any>([]);
  readonly bestSellerProducts = signal<any>([]);
  readonly isLoadingProducts = signal<any>(true);
  readonly productError = signal<any>("");
  readonly flashSaleEndsAt = signal<any>(getFallbackFlashSaleEndTime);
  readonly flashSaleCountdown = signal<any>((() => getRemainingTimeParts(this.flashSaleEndsAt()))());
  readonly promotionPageIndex = signal<any>(0);
  readonly promoDirection = signal<any>(0);
  readonly promoTimerRef: { current: any } = { current: null };

  constructor() {
    // useEffect(..., []) -> chạy 1 lần sau khi render
    afterNextRender(() => {
      const cleanup = (() => {
        let isMounted = true;

        const loadSectionProducts = async () => {
          try {
            this.isLoadingProducts.set(true);
            this.productError.set("");
            const [activeFlashSale, bestSellingProducts] = await Promise.all([
              this.productApi.getActiveFlashSale(12),
              this.productApi.getBestSellingProducts(12),
            ]);

            if (isMounted) {
              const activeFlashSaleProducts = activeFlashSale?.products ?? [];
              this.flashProducts.set(Array.isArray(activeFlashSaleProducts) ? activeFlashSaleProducts : []);
              this.flashSaleEndsAt.set(getFlashSaleCountdownTarget(activeFlashSale?.sale));
              this.bestSellerProducts.set(Array.isArray(bestSellingProducts) ? bestSellingProducts : []);
            }
          } catch {
            if (isMounted) {
              this.productError.set("");
              this.flashProducts.set(FEATURED_PRODUCTS.filter((product: any) => product.discountPercent).slice(0, 12));
              this.flashSaleEndsAt.set(getFallbackFlashSaleEndTime());
              this.bestSellerProducts.set(SHOP_PRODUCTS.slice(0, 12));
            }
          } finally {
            if (isMounted) {
              this.isLoadingProducts.set(false);
            }
          }
        }

        loadSectionProducts();

        return () => {
          isMounted = false;
        };
      })();
      if (typeof cleanup === 'function') this.destroyRef.onDestroy(cleanup);
    });

    // useEffect(..., [flashSaleEndsAt])
    effect((onCleanup: any) => {
      this.flashSaleEndsAt();
      const cleanup = untracked(() => {
        this.flashSaleCountdown.set(getRemainingTimeParts(this.flashSaleEndsAt()));
        const timer = window.setInterval(() => {
          this.flashSaleCountdown.set(getRemainingTimeParts(this.flashSaleEndsAt()));
        }, 1000);

        return () => window.clearInterval(timer);
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });

    // useEffect(..., [flashDisplayProducts.length])
    effect((onCleanup: any) => {
      this.flashDisplayProducts().length;
      const cleanup = untracked(() => {
        this.flashOffset.set(0);
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });

    // useEffect(..., [advancePromo])
    effect((onCleanup: any) => {
      const cleanup = untracked(() => {
        this.promoTimerRef.current = setInterval(this.advancePromo.bind(this), 5000);
        return () => clearInterval(this.promoTimerRef.current);
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });
  }

  protected goPrevFlash() {
    if (!this.canGoPrev()) return;
    this.flashOffset.update((prev: any) => prev - 1);
  }

  protected goNextFlash() {
    if (!this.canGoNext()) return;
    this.flashOffset.update((prev: any) => prev + 1);
  }

  protected advancePromo() {
    this.promoDirection.set(1);
    this.promotionPageIndex.update((prev: any) => (prev + 1) % SHOP_PROMOTION_PAGES.length);
  }

  protected goPromoPage(idx: any) {
    if (idx === this.promotionPageIndex()) return;
    clearInterval(this.promoTimerRef.current);
    const forward = idx > this.promotionPageIndex()
      ? idx - Number(this.promotionPageIndex())
      : idx + SHOP_PROMOTION_PAGES.length - Number(this.promotionPageIndex());
    this.promoDirection.set(forward <= SHOP_PROMOTION_PAGES.length / 2 ? 1 : -1);
    this.promotionPageIndex.set(idx);
    this.promoTimerRef.current = setInterval(this.advancePromo.bind(this), 5000);
  }

  protected goPrevPromotion() {
    clearInterval(this.promoTimerRef.current);
    const next = (Number(this.promotionPageIndex()) - 1 + SHOP_PROMOTION_PAGES.length) % SHOP_PROMOTION_PAGES.length;
    this.goPromoPage(next);
  }

  protected goNextPromotion() {
    clearInterval(this.promoTimerRef.current);
    this.goPromoPage((this.promotionPageIndex() + 1) % SHOP_PROMOTION_PAGES.length);
  }

  protected pausePromo() {
    clearInterval(this.promoTimerRef.current);
  }

  protected resumePromo() {
    clearInterval(this.promoTimerRef.current);
    this.promoTimerRef.current = setInterval(this.advancePromo.bind(this), 5000);
  }

  /** (tự sinh) SpreadElement không dùng trực tiếp được trong template */
  protected styles2(): any {
    return { ...SECTION_TITLE_TYPOGRAPHY };
  }

  /** (tự sinh) SpreadElement không dùng trực tiếp được trong template */
  protected styles3(): any {
    return { ...SECTION_TITLE_TYPOGRAPHY };
  }

  /** (tự sinh) SpreadElement không dùng trực tiếp được trong template */
  protected styles4(): any {
    return { ...SECTION_TITLE_TYPOGRAPHY };
  }
}

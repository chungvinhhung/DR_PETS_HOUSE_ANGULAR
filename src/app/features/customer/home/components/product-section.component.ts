import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, inject, signal } from '@angular/core';

import { ProductApiService } from '../../../../core/customer/services/api/product-api.service';
import { SectionTitleComponent } from '../../../../shared/customer/components/section-title/section-title.component';
import { ProductCardComponent } from '../../../../shared/customer/components/product-card/product-card.component';
import { YellowButtonComponent } from '../../../../shared/customer/components/yellow-button/yellow-button.component';
import { ReactStyleDirective } from '../../../../shared/customer/directives/react-style.directive';
import { CustomerLinkDirective } from '../../../../shared/customer/directives/customer-link.directive';
import { FEATURED_PRODUCTS, PRODUCT_CATEGORIES } from '../../../../shared/customer/data/shop-data';

/**
 * ProductSection — chuyển từ React: src/components/home/ProductSection.jsx
 */
@Component({
  selector: 'app-product-section',
  standalone: true,
  imports: [SectionTitleComponent, ProductCardComponent, YellowButtonComponent, ReactStyleDirective, CustomerLinkDirective],
  templateUrl: './product-section.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductSectionComponent {
  // --- Service dùng chung ---
  protected readonly productApi = inject(ProductApiService);
  private readonly destroyRef = inject(DestroyRef);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly PRODUCT_CATEGORIES: any = PRODUCT_CATEGORIES;

  // --- Trạng thái (signal = useState / useRef) ---
  readonly products = signal<any>([]);
  readonly isLoadingProducts = signal<any>(true);
  readonly loadError = signal<any>("");

  constructor() {
    // useEffect(..., []) -> chạy 1 lần sau khi render
    afterNextRender(() => {
      const cleanup = (() => {
        let isMounted = true;

        const loadProducts = async () => {
          try {
            this.isLoadingProducts.set(true);
            this.loadError.set("");
            const data = await this.productApi.getBestSellingProducts(12);
            if (isMounted) {
              this.products.set(Array.isArray(data) ? data : []);
            }
          } catch {
            if (isMounted) {
              this.loadError.set("");
              this.products.set(FEATURED_PRODUCTS);
            }
          } finally {
            if (isMounted) {
              this.isLoadingProducts.set(false);
            }
          }
        }

        loadProducts();

        return () => {
          isMounted = false;
        };
      })();
      if (typeof cleanup === 'function') this.destroyRef.onDestroy(cleanup);
    });
  }

}

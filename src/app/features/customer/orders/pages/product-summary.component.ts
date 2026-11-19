import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { productImages } from '../../../../shared/customer/assets/product-images';
import { formatCurrency } from '../data/order-data';
import { EMPTY_ORDER_PRODUCT, getOrderProductType, getOrderProductSize } from './order-pages-yellow-button.helpers';

/**
 * ProductSummary — chuyển từ React: src/pages/Order/OrderPages.jsx
 */
@Component({
  selector: 'div[app-product-summary]',
  standalone: true,
  imports: [],
  templateUrl: './product-summary.component.html',
  styleUrl: './product-summary.component.scss',
  host: {
    '[class]': '`flex items-center gap-[10px] ${large() ? \'min-h-[100px] w-full\' : \'h-[100px] w-[372px]\'}`',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductSummaryComponent {
  // --- Input / Output (props của React) ---
  readonly product = input<any>(undefined);
  readonly large = input<any>(false);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly productImages: any = productImages;
  protected readonly formatCurrency: any = formatCurrency;

  // --- Giá trị tính toán (computed) ---
  readonly safeProduct = computed<any>(() => this.product() || EMPTY_ORDER_PRODUCT);
  readonly productType = computed<any>(() => getOrderProductType(this.safeProduct()));
  readonly productSize = computed<any>(() => getOrderProductSize(this.safeProduct()));
  readonly productImage = computed<any>(() => {
    const p = this.safeProduct();
    const raw = p?.image || p?.photoUrl || p?.photo_url || p?.imageUrl || p?.image_url || p?.product?.product_images?.[0]?.image_url;
    return raw || productImages.detailImage;
  });

  onImageError(event: Event) {
    (event.target as HTMLImageElement).src = this.productImages.detailImage;
  }
}

import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked } from '@angular/core';

import { WriteReviewFormComponent } from '../../products/components/write-review-form.component';
import { productImages } from '../../../../shared/customer/assets/product-images';

/**
 * OrderReviewModal — chuyển từ React: src/pages/Order/OrderPages.jsx
 */
@Component({
  selector: 'div[app-order-review-modal]',
  standalone: true,
  imports: [WriteReviewFormComponent],
  templateUrl: './order-review-modal.component.html',
  host: {
    'class': 'fixed inset-0 z-[120] flex items-center justify-center bg-black/30 px-6 py-10 backdrop-blur-[2px]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderReviewModalComponent {
  // --- Input / Output (props của React) ---
  readonly order = input<any>(undefined);
  readonly reviewableProducts = input<any>(undefined);
  readonly isLoading = input<any>(undefined);
  readonly submitLoading = input<any>(undefined);
  readonly onClose = output<any>();
  readonly onSubmit = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly productImages: any = productImages;

  // --- Giá trị tính toán (computed) ---
  readonly selectedProduct = computed<any>(() => this.reviewableProducts().find(
    (product: any) => String(product.productId) === String(this.selectedProductId()),
  ));

  // --- Trạng thái (signal = useState / useRef) ---
  readonly selectedProductId = signal<any>("");

  constructor() {
    // useEffect(..., [reviewableProducts])
    effect((onCleanup: any) => {
      this.reviewableProducts();
      const cleanup = untracked(() => {
        if (!this.reviewableProducts().length) {
          this.selectedProductId.set("");
          return;
        }

        this.selectedProductId.update((current: any) =>
          this.reviewableProducts().some((product: any) => String(product.productId) === String(current))
            ? current
            : String(this.reviewableProducts()[0].productId));
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });
  }

  /** (tự sinh) global String không dùng trực tiếp được trong template */
  protected compute1(product: any): any {
    return String(product.productId) === String(this.selectedProductId());
  }

  protected handle2(product: any) {
    this.selectedProductId.set(String(product.productId));
  }
}

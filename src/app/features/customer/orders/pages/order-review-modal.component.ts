import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import { CustomerAuthService } from '../../../../core/customer/services/customer-auth.service';
import { WriteReviewFormComponent } from '../../products/components/write-review-form.component';
import { productImages } from '../../../../shared/customer/assets/product-images';

@Component({
  selector: 'div[app-order-review-modal]',
  standalone: true,
  imports: [WriteReviewFormComponent],
  templateUrl: './order-review-modal.component.html',
  styleUrl: './order-review-modal.component.scss',
  host: {
    'class': 'fixed inset-0 z-[120] flex items-center justify-center bg-black/30 px-6 py-10 backdrop-blur-[2px]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderReviewModalComponent {
  private readonly authService = inject(CustomerAuthService);

  // --- Input / Output ---
  readonly order = input<any>(undefined);
  readonly reviewableProducts = input<any>(undefined);
  readonly isLoading = input<any>(undefined);
  readonly submitLoading = input<any>(undefined);
  readonly onClose = output<any>();
  readonly onSubmit = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly productImages: any = productImages;

  // --- Lấy thông tin khách hàng đang đăng nhập ---
  readonly loggedInName = computed<string>(() => {
    const user = (this.authService as any).currentUser?.() || (this.authService as any).user?.();
    return (
      user?.fullName ||
      user?.full_name ||
      user?.name ||
      this.order()?.customerName ||
      this.order()?.customer_name ||
      ''
    );
  });

  // --- Trạng thái tên hiển thị & ẩn danh ---
  readonly reviewerName = signal<string>('');
  readonly isAnonymous = signal<boolean>(false);
  readonly isEditingName = signal<boolean>(false);

  // Tên cuối cùng gửi lên API khi submit
  readonly displayAuthorName = computed<string>(() => {
    if (this.isAnonymous()) return 'Khách hàng ẩn danh';
    return this.reviewerName().trim() || this.loggedInName() || 'Khách hàng';
  });

  // --- Sản phẩm đang chọn ---
  readonly selectedProductId = signal<any>('');
  readonly selectedProduct = computed<any>(() =>
    this.reviewableProducts()?.find(
      (product: any) => String(product.productId) === String(this.selectedProductId()),
    ),
  );

  constructor() {
    // Tự động điền tên khách hàng khi mở modal hoặc khi thông tin đăng nhập tải xong
    effect(() => {
      const defaultName = this.loggedInName();
      untracked(() => {
        if (defaultName && !this.reviewerName()) {
          this.reviewerName.set(defaultName);
        }
      });
    });

    // Chọn sản phẩm đầu tiên có thể đánh giá
    effect(() => {
      const products = this.reviewableProducts() || [];
      untracked(() => {
        if (!products.length) {
          this.selectedProductId.set('');
          return;
        }
        this.selectedProductId.update((current: any) =>
          products.some((product: any) => String(product.productId) === String(current))
            ? current
            : String(products[0].productId),
        );
      });
    });
  }

  protected toggleAnonymous(): void {
    this.isAnonymous.update((v) => !v);
    if (this.isAnonymous()) {
      this.isEditingName.set(false);
    }
  }

  protected handleNameInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.reviewerName.set(value);
  }

  protected handleFormSubmit(payload: any): void {
    this.onSubmit.emit({
      ...payload,
      authorName: this.displayAuthorName(),
      customerName: this.displayAuthorName(),
      isAnonymous: this.isAnonymous(),
    });
  }

  protected compute1(product: any): any {
    return String(product.productId) === String(this.selectedProductId());
  }

  protected handle2(product: any) {
    this.selectedProductId.set(String(product.productId));
  }
}

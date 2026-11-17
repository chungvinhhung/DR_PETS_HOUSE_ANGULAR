import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';

import { CartService } from '../../../../core/customer/services/cart.service';
import { DecisionModalService } from '../../../../core/customer/services/decision-modal.service';
import { CustomerNavigationService } from '../../../../core/customer/services/customer-navigation.service';
import { ProductApiService } from '../../../../core/customer/services/api/product-api.service';
import { SelectValueDirective } from '../../../../shared/customer/directives/select-value.directive';
import { cartImages } from '../../../../shared/customer/assets/cart-images';
import { formatPrice, normalizeVariantOption } from './my-cart-panel.helpers';
import { buildProductPath } from '../../../../shared/customer/utils/slug';

/**
 * CartItemRow — chuyển từ React: src/components/cart/MyCartPanel.jsx
 */
@Component({
  selector: 'div[app-cart-item-row]',
  standalone: true,
  imports: [SelectValueDirective],
  templateUrl: './cart-item-row.component.html',
  styleUrl: './cart-item-row.component.scss',
  host: {
    '[class]': '`relative flex min-h-[118px] w-full shrink-0 items-center gap-[10px] border-b border-solid border-[#e0e0e0] px-[6px] py-[10px] transition-all duration-200 lg:my-[10px] lg:min-h-[132px] lg:w-full lg:px-[10px] lg:py-[14px] ${ deleting() ? \'translate-x-full opacity-0\' : \'translate-x-0 opacity-100\' }`',
    '[attr.role]': 'item().productId ? \'link\' : undefined',
    '[attr.tabindex]': 'item().productId ? 0 : undefined',
    '(click)': 'handleOpenProduct()',
    '(keydown)': 'handleOpenProductByKeyboard($any($event))',
    '[attr.aria-label]': 'item().productId ? `Xem chi tiết ${item().name}` : undefined',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartItemRowComponent {
  // --- Service dùng chung ---
  protected readonly cartService = inject(CartService);
  protected readonly decisionModalService = inject(DecisionModalService);
  protected readonly navService = inject(CustomerNavigationService);
  protected readonly productApi = inject(ProductApiService);

  // --- Input / Output (props của React) ---
  readonly item = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly cartImages: any = cartImages;
  protected readonly formatPrice: any = formatPrice;

  // --- Giá trị tính toán (computed) ---
  readonly variantOptions = computed<any>(() => (Array.isArray(this.item().variants) && this.item().variants.length ? this.item().variants : this.loadedVariants()).map(normalizeVariantOption));
  readonly selectedVariant = computed<any>(() => this.variantOptions().find((variant: any) => String(variant.id) === String(this.item().variantId)) ||
    this.variantOptions().find((variant: any) => variant.name === this.item().type) ||
    this.variantOptions().find((variant: any) => variant.name === this.item().variant_name) ||
    this.variantOptions()[0]);
  readonly variantDisplayName = computed<any>(() => {
    const raw = this.item().type || this.item().variant_name || this.selectedVariant()?.name || this.item().variant?.variant_name;
    if (raw && raw !== 'Mặc định') return raw;
    return this.selectedVariant()?.name || this.item().type || 'Mặc định';
  });
  readonly sizeOptions = computed<any>(() => this.selectedVariant()?.sizes?.length ? this.selectedVariant().sizes : this.item().size ? [this.item().size] : []);

  // --- Trạng thái (signal = useState / useRef) ---
  readonly deleting = signal<any>(false);
  readonly loadedVariants = signal<any>([]);

  constructor() {
    // useEffect(..., [item.productId, item.variants])
    effect((onCleanup: any) => {
      this.item().productId;
      this.item().variants;
      const cleanup = untracked(() => {
        if ((Array.isArray(this.item().variants) && this.item().variants.length) || !this.item().productId) return;
        let active = true;
        this.productApi.getProductDetails(this.item().productId)
          .then((product: any) => {
            if (active) this.loadedVariants.set(product.variants || []);
          })
          .catch(() => {
            if (active) this.loadedVariants.set([]);
          });
        return () => {
          active = false;
        };
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });
  }

  protected handleDelete() {
    this.decisionModalService.confirmDelete({
      message: `Bạn chắc chắn muốn xóa "${this.item().name}" khỏi giỏ hàng?\nHành động này không thể hoàn tác`,
      confirmLabel: "Xóa",
      onConfirm: () => {
        this.deleting.set(true);
        setTimeout(() => {
          this.cartService.removeCartItem(this.item().id);
          this.decisionModalService.showSuccessModal({
            message: "Đã xóa sản phẩm khỏi giỏ hàng.\nBạn có thể tiếp tục mua sắm hoặc quay về trang chủ",
          });
        }, 250);
      },
    });
  }

  protected handleVariantChange(event: any) {
    const nextVariant = this.variantOptions().find((variant: any) => String(variant.id) === event.target.value);
    if (!nextVariant) return;
    const nextSize = nextVariant.sizes?.includes(this.item().size) ? this.item().size : nextVariant.sizes?.[0] || "";
    this.cartService.updateCartOptions(this.item().id, {
      variantId: nextVariant.id,
      type: nextVariant.name,
      size: nextSize,
      price: nextVariant.price || this.item().price,
    });
  }

  protected handleSizeChange(event: any) {
    this.cartService.updateCartOptions(this.item().id, { size: event.target.value });
  }

  protected handleOpenProduct() {
    if (!this.item().productId) return;
    this.navService.navigate(buildProductPath({ id: this.item().productId, name: this.item().name }));
  }

  protected handleOpenProductByKeyboard(event: any) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this.handleOpenProduct();
    }
  }

  protected stopCardNavigation(event: any) {
    event.stopPropagation();
  }

  protected handle1(event: any) {
    this.stopCardNavigation(event);
    this.cartService.toggleCartItem(this.item().id);
  }

  protected handle2(event: any) {
    this.stopCardNavigation(event);
    this.handleDelete();
  }

  protected handle3(event: any) {
    this.stopCardNavigation(event);
    this.cartService.updateCartQty(this.item().id, -1);
  }

  protected handle4(event: any) {
    this.stopCardNavigation(event);
    this.cartService.updateCartQty(this.item().id, 1);
  }

  /** (tự sinh) global String không dùng trực tiếp được trong template */
  protected compute5(): any {
    return String(this.selectedVariant()?.id ?? this.item().variantId ?? "");
  }

  /** (tự sinh) global String không dùng trực tiếp được trong template */
  protected compute6(variant: any): any {
    return String(variant.id ?? "");
  }
}

import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';

import { CartService } from '../../../../core/customer/services/cart.service';
import { CartItemRowComponent } from './cart-item-row.component';
import { cartImages } from '../../../../shared/customer/assets/cart-images';
import { getNumericPrice } from '../../../../shared/customer/utils/currency';
import { formatPrice } from './my-cart-panel.helpers';

/**
 * MyCartPanel — chuyển từ React: src/components/cart/MyCartPanel.jsx
 */
@Component({
  selector: 'aside[app-my-cart-panel]',
  standalone: true,
  imports: [CartItemRowComponent],
  templateUrl: './my-cart-panel.component.html',
  host: {
    'class': 'cart-panel-motion pointer-events-auto absolute inset-0 flex h-screen w-full flex-col items-center gap-[10px] overflow-hidden bg-[#fffde7] px-[10px] py-0 lg:inset-auto lg:right-[94px] lg:top-0 lg:h-[638px] lg:max-h-[calc(100vh-104px)] lg:w-[551px] lg:rounded lg:px-5 lg:py-[10px] lg:shadow-[0_4px_24px_rgba(0,0,0,0.12)]',
    'data-name': 'my cart',
    'role': 'dialog',
    'aria-label': 'Giỏ hàng',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyCartPanelComponent {
  // --- Service dùng chung ---
  protected readonly cartService = inject(CartService);

  // --- Input / Output (props của React) ---
  readonly onClose = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly cartImages: any = cartImages;
  protected readonly formatPrice: any = formatPrice;

  // --- Giá trị tính toán (computed) ---
  readonly itemCount = computed<any>(() => this.cartService.cartItems().length);
  readonly selectedCount = computed<any>(() => this.cartService.cartItems().filter((i: any) => i.selected).length);
  readonly hasItems = computed<any>(() => this.itemCount() > 0);
  readonly subtotal = computed<any>(() => this.cartService.cartItems()
    .filter((item: any) => item.selected)
    .reduce((total: any, item: any) => total + getNumericPrice(item.price) * item.qty, 0));

}

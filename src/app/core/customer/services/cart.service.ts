import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

import { CartApiService } from './api/cart-api.service';
import { CustomerAuthService } from './customer-auth.service';

export type PaymentMode = 'cod' | 'online' | string;

function buildCartItemKey(product: any = {}): string {
  return `${product.productId || product.product_id || product.id}:${product.variantId || product.variant_id || 'default'}:${product.size || 'default'}`;
}

function getCartItemOptionKey(item: any = {}): string {
  return `${item.productId || item.product_id || item.id}:${item.variantId || item.variant_id || 'default'}:${item.size || 'default'}`;
}

/**
 * Giỏ hàng + luồng thanh toán (thay cho context/CartContext.jsx của React).
 *
 * Quản lý:
 *  - danh sách sản phẩm trong giỏ (đồng bộ với API /cart khi đã đăng nhập)
 *  - trạng thái mở/đóng: giỏ hàng (CartDrawer), thanh toán (CheckoutOverlay),
 *    chuyển khoản (BankTransferModal), đặt hàng thành công (OrderSuccessOverlay / GuestOrderSuccessOverlay)
 * Các overlay này được đặt sẵn trong CustomerLayoutComponent, chỉ cần gọi openCart(), openCheckout()...
 */
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly auth = inject(CustomerAuthService);
  private readonly cartApi = inject(CartApiService);

  readonly isCartOpen = signal(false);
  /** Tên cũ trong React (isOpen) - giữ lại cho tương thích */
  readonly isOpen = this.isCartOpen;
  readonly isCheckoutOpen = signal(false);
  readonly isOrderSuccessOpen = signal(false);
  readonly isGuestSuccessOpen = signal(false);
  readonly isBankTransferOpen = signal(false);
  readonly paymentMode = signal<PaymentMode>('cod');
  readonly onlineMethod = signal<string>('bank');
  readonly lastOrderResult = signal<any>(null);
  readonly cartSyncError = signal('');
  readonly cartLoading = signal(false);
  readonly cartItems = signal<any[]>([]);

  constructor() {
    // Khi đăng nhập/đăng xuất -> tải lại giỏ hàng từ server
    effect(() => {
      const authenticated = this.auth.isAuthenticated();
      untracked(() => {
        if (!authenticated) {
          this.cartSyncError.set('');
          this.cartLoading.set(false);
          return;
        }
        void this.reloadCart();
      });
    });
    // Đổi trang -> đóng giỏ hàng
    inject(Router).events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => this.isCartOpen.set(false));
  }

  readonly setPaymentMode = (mode: PaymentMode): void => {
    this.paymentMode.set(mode);
  }

  readonly setOnlineMethod = (method: string): void => {
    this.onlineMethod.set(method);
  }

  readonly reloadCart = async (): Promise<void> => {
    if (!this.auth.isAuthenticated()) return;
    this.cartLoading.set(true);
    this.cartSyncError.set('');
    try {
      const cart = await this.cartApi.getCart();
      this.cartItems.set(cart.items);
    } catch (error: any) {
      this.cartSyncError.set(error?.message || 'Không thể tải giỏ hàng');
    } finally {
      this.cartLoading.set(false);
    }
  }

  private syncFailed(error: any, fallback: string): void {
    this.cartSyncError.set(error?.message || fallback);
    void this.reloadCart();
  }

  readonly toggleCartItem = (id: string): void => {
    const currentItem = this.cartItems().find((item) => item.id === id);
    this.cartItems.update((items) => items.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)));
    if (this.auth.isAuthenticated() && currentItem?.cartItemId) {
      this.cartApi.updateCartItem(currentItem.cartItemId, { isSelected: !currentItem.selected })
        .catch((error) => this.syncFailed(error, 'Không thể cập nhật giỏ hàng'));
    }
  }

  readonly removeCartItem = (id: string): void => {
    const currentItem = this.cartItems().find((item) => item.id === id);
    this.cartItems.update((items) => items.filter((item) => item.id !== id));
    if (this.auth.isAuthenticated() && currentItem?.cartItemId) {
      this.cartApi.deleteCartItem(currentItem.cartItemId).catch((error) => this.syncFailed(error, 'Không thể xóa sản phẩm'));
    }
  }

  readonly updateCartQty = (id: string, delta: number): void => {
    const currentItem = this.cartItems().find((item) => item.id === id);
    const nextQuantity = Math.max(1, (currentItem?.qty || 1) + delta);
    this.cartItems.update((items) => items.map((item) => (item.id === id ? { ...item, qty: Math.max(1, item.qty + delta) } : item)));
    if (this.auth.isAuthenticated() && currentItem?.cartItemId) {
      this.cartApi.updateCartItem(currentItem.cartItemId, { quantity: nextQuantity })
        .catch((error) => this.syncFailed(error, 'Không thể cập nhật số lượng'));
    }
  }

  readonly updateCartOptions = (id: string, updates: Record<string, any>): void => {
    const items = this.cartItems();
    const currentItem = items.find((item) => item.id === id);
    if (!currentItem) return;

    const nextItem = { ...currentItem, ...updates };
    const nextOptionKey = getCartItemOptionKey(nextItem);
    const existingItem = items.find((item) => item.id !== id && getCartItemOptionKey(item) === nextOptionKey);

    this.cartItems.set(
      existingItem
        ? items
            .filter((item) => item.id !== id)
            .map((item) =>
              item.id === existingItem.id
                ? { ...item, qty: item.qty + currentItem.qty, selected: item.selected || currentItem.selected }
                : item,
            )
        : items.map((item) => (item.id === id ? { ...item, ...updates, id: item.cartItemId ? item.id : nextOptionKey } : item)),
    );

    if (this.auth.isAuthenticated() && currentItem.cartItemId) {
      const request = existingItem?.cartItemId
        ? Promise.all([
            this.cartApi.updateCartItem(existingItem.cartItemId, {
              quantity: existingItem.qty + currentItem.qty,
              isSelected: existingItem.selected || currentItem.selected,
            }),
            this.cartApi.deleteCartItem(currentItem.cartItemId),
          ])
        : this.cartApi.updateCartItem(currentItem.cartItemId, updates);
      request.catch((error) => this.syncFailed(error, 'Không thể cập nhật tùy chọn sản phẩm'));
    }
  }

  readonly addToCart = (product: any): void => {
    const localId = buildCartItemKey(product);
    this.cartItems.update((items) => {
      const existing = items.find((i) => i.id === localId);
      if (existing) {
        return items.map((i) => (i.id === localId ? { ...i, qty: i.qty + (product.qty || 1), selected: true } : i));
      }
      return [...items, { ...product, id: localId, qty: product.qty || 1, selected: true }];
    });
    if (this.auth.isAuthenticated()) {
      this.cartApi.addCartItem(product)
        .then(() => this.reloadCart())
        .catch((error) => this.syncFailed(error, 'Không thể thêm vào giỏ hàng'));
    }
  }

  /** "Mua ngay": thay giỏ bằng các sản phẩm được chọn rồi mở thanh toán */
  readonly replaceCartItemsForCheckout = (products: any[] = []): void => {
    this.cartItems.set(
      products.map((product) => ({
        ...product,
        id: buildCartItemKey(product),
        qty: product.qty || product.quantity || 1,
        selected: true,
      })),
    );
  }

  readonly openCart = (): void => {
    this.isCheckoutOpen.set(false);
    this.isOrderSuccessOpen.set(false);
    this.isGuestSuccessOpen.set(false);
    this.isBankTransferOpen.set(false);
    this.isCartOpen.set(true);
  }

  readonly closeCart = (): void => {
    this.isCartOpen.set(false);
  }

  readonly toggleCart = (): void => {
    this.isCartOpen.update((open) => !open);
  }

  readonly openCheckout = (): void => {
    this.isCartOpen.set(false);
    this.paymentMode.set('cod');
    this.onlineMethod.set('bank');
    this.isBankTransferOpen.set(false);
    this.isCheckoutOpen.set(true);
  }

  readonly closeCheckout = (): void => {
    this.isCheckoutOpen.set(false);
  }

  readonly backToCart = (): void => {
    this.isCheckoutOpen.set(false);
    this.isOrderSuccessOpen.set(false);
    this.isGuestSuccessOpen.set(false);
    this.isBankTransferOpen.set(false);
    this.isCartOpen.set(true);
  }

  private showOrderSuccess(orderResult: any = null): void {
    if (orderResult) this.lastOrderResult.set(orderResult);
    this.isCartOpen.set(false);
    this.isCheckoutOpen.set(false);
    this.isBankTransferOpen.set(false);
    if (this.auth.isAuthenticated()) {
      this.isGuestSuccessOpen.set(false);
      this.isOrderSuccessOpen.set(true);
    } else {
      this.isOrderSuccessOpen.set(false);
      this.isGuestSuccessOpen.set(true);
    }
  }

  readonly confirmOrder = (orderResult: any = null): void => {
    if (orderResult) this.lastOrderResult.set(orderResult);
    if (this.paymentMode() === 'online' && this.onlineMethod() === 'bank') {
      this.isBankTransferOpen.set(true);
      return;
    }
    this.showOrderSuccess(orderResult);
  }

  readonly closeBankTransfer = (): void => {
    this.isBankTransferOpen.set(false);
  }

  readonly completeBankTransfer = (): void => {
    this.showOrderSuccess(this.lastOrderResult());
  }

  readonly closeOrderSuccess = (): void => {
    this.isOrderSuccessOpen.set(false);
  }

  readonly closeGuestSuccess = (): void => {
    this.isGuestSuccessOpen.set(false);
  }
}

import { ChangeDetectionStrategy, Component, computed, effect, inject, output, signal, untracked } from '@angular/core';

import { CustomerAuthService } from '../../../../core/customer/services/customer-auth.service';
import { CartService } from '../../../../core/customer/services/cart.service';
import { OrderApiService } from '../../../../core/customer/services/api/order-api.service';
import { UserApiService } from '../../../../core/customer/services/api/user-api.service';
import { AddressChangeModalComponent } from './address-change-modal.component';
import { GuestLoginBannerComponent } from './guest-login-banner.component';
import { GuestShippingFormComponent } from './guest-shipping-form.component';
import { AuthenticatedAddressCardComponent } from './authenticated-address-card.component';
import { OrderDetailsCardComponent } from './order-details-card.component';
import { PaymentModeToggleComponent } from './payment-mode-toggle.component';
import { OnlinePaymentMethodsComponent } from './online-payment-methods.component';
import { CouponAndSummaryComponent } from './coupon-and-summary.component';
import { checkoutImages } from '../assets/checkout-assets';
import { DEFAULT_USER_ADDRESSES } from '../../../../core/customer/constants/user-profile-data';

/**
 * ShoppingCheckout — chuyển từ React: src/components/checkout/ShoppingCheckout.jsx
 */
@Component({
  selector: 'div[app-shopping-checkout]',
  standalone: true,
  imports: [AddressChangeModalComponent, GuestLoginBannerComponent, GuestShippingFormComponent, AuthenticatedAddressCardComponent, OrderDetailsCardComponent, PaymentModeToggleComponent, OnlinePaymentMethodsComponent, CouponAndSummaryComponent],
  templateUrl: './shopping-checkout.component.html',
  host: {
    'class': 'pointer-events-auto fixed inset-0 z-[70] overflow-y-auto bg-[#e5f6fd]',
    'role': 'dialog',
    'aria-label': 'Thanh toán',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShoppingCheckoutComponent {
  // --- Service dùng chung ---
  protected readonly authService = inject(CustomerAuthService);
  protected readonly cartService = inject(CartService);
  protected readonly orderApi = inject(OrderApiService);
  protected readonly userApi = inject(UserApiService);

  // --- Input / Output (props của React) ---
  readonly onBack = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly checkoutImages: any = checkoutImages;

  // --- Giá trị tính toán (computed) ---
  readonly isGuest = computed<any>(() => !this.authService.isAuthenticated());
  readonly orderItems = computed<any>(() => this.cartService.cartItems().filter((item: any) => item.selected));
  readonly selectedAddress = computed<any>(() => this.addresses().find((address: any) => address.id === this.selectedAddressId()) || this.addresses()[0] || null);

  // --- Trạng thái (signal = useState / useRef) ---
  readonly note = signal<any>("");
  readonly guestForm = signal<any>({
    fullName: "",
    phone: "",
    email: "",
    country: "Việt Nam",
    address: "",
    city: "",
  });
  readonly showAddressModal = signal<any>(false);
  readonly addresses = signal<any>([]);
  readonly selectedAddressId = signal<any>(null);
  readonly addressesLoading = signal<any>(false);
  readonly addressError = signal<any>("");

  constructor() {
    // useEffect(..., [isGuest, userProfile?.userId])
    effect((onCleanup: any) => {
      this.isGuest();
      this.authService.userProfile()?.userId;
      const cleanup = untracked(() => {
        if (this.isGuest() || !this.authService.userProfile()?.userId) {
          this.addresses.set([]);
          this.selectedAddressId.set(null);
          return undefined;
        }

        let isMounted = true;
        this.addressesLoading.set(true);
        this.addressError.set("");

        this.userApi.getUserAddresses(this.authService.userProfile().userId)
          .then((items: any) => {
            if (!isMounted) return;
            this.addresses.set(items);
            const defaultAddress = items.find((address: any) => address.isDefault) || items[0] || null;
            this.selectedAddressId.set(defaultAddress?.id ?? null);
          })
          .catch((error: any) => {
            if (!isMounted) return;
            this.addresses.set(DEFAULT_USER_ADDRESSES);
            this.selectedAddressId.set(DEFAULT_USER_ADDRESSES[0]?.id ?? null);
            this.addressError.set(error?.message || "Không thể tải địa chỉ, đang hiển thị địa chỉ mẫu.");
          })
          .finally(() => {
            if (isMounted) this.addressesLoading.set(false);
          });

        return () => {
          isMounted = false;
        };
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });
  }

  protected async submitOrder(voucherCode: any) {
    if (!this.isGuest() && !this.selectedAddress()?.id) {
      throw new Error("Vui lòng chọn hoặc thêm địa chỉ nhận hàng");
    }

    const result = this.isGuest()
      ? await this.orderApi.guestCheckoutOrder({
          guest: this.guestForm(),
          paymentMethod: this.cartService.paymentMode(),
          voucherCode,
          note: this.note(),
          items: this.orderItems(),
        })
      : await this.orderApi.checkoutOrder({
          addressId: this.selectedAddress().addressId || this.selectedAddress().id,
          paymentMethod: this.cartService.paymentMode(),
          voucherCode,
          note: this.note(),
          items: this.orderItems(),
        });
    this.cartService.confirmOrder(result);
  }

  protected async saveAddress(address: any) {
    if (!this.authService.userProfile()?.userId) {
      throw new Error("Không tìm thấy thông tin người dùng");
    }

    if (address.id) {
      const updatedAddress = await this.userApi.updateUserAddress(address.addressId || address.id, address);
      this.addresses.update((current: any) =>
        current.map((item: any) => (item.id === updatedAddress.id ? updatedAddress : item)));
      this.selectedAddressId.set(updatedAddress.id);
      return;
    }

    const newAddress = await this.userApi.createUserAddress(this.authService.userProfile().userId, {
      ...address,
      isDefault: this.addresses().length === 0,
    });
    this.addresses.update((current: any) => [...current, newAddress]);
    this.selectedAddressId.set(newAddress.id);
  }

  protected handle1(address: any) {
    this.selectedAddressId.set(address.id);
    this.showAddressModal.set(false);
  }
}

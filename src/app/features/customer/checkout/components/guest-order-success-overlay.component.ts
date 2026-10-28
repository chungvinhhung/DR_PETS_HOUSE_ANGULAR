import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { CartService } from '../../../../core/customer/services/cart.service';
import { CustomerAuthService } from '../../../../core/customer/services/customer-auth.service';
import { CustomerNavigationService } from '../../../../core/customer/services/customer-navigation.service';
import { GUEST_ACCOUNT_CREDENTIALS, guestSuccessImages } from '../assets/guest-success-assets';

/**
 * GuestOrderSuccessOverlay — chuyển từ React: src/components/checkout/GuestOrderSuccessOverlay.jsx
 */
@Component({
  selector: 'app-guest-order-success-overlay',
  standalone: true,
  imports: [],
  templateUrl: './guest-order-success-overlay.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuestOrderSuccessOverlayComponent {
  // --- Service dùng chung ---
  protected readonly cartService = inject(CartService);
  protected readonly authService = inject(CustomerAuthService);
  protected readonly navService = inject(CustomerNavigationService);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly guestSuccessImages: any = guestSuccessImages;

  // --- Giá trị tính toán (computed) ---
  readonly guestAccount = computed<any>(() => this.cartService.lastOrderResult()?.guest_account || GUEST_ACCOUNT_CREDENTIALS);

  protected handleGoHome() {
    this.cartService.closeGuestSuccess();
    this.navService.navigate("/");
  }

  protected handleLogin() {
    this.cartService.closeGuestSuccess();
    this.authService.openAuth("login");
  }
}

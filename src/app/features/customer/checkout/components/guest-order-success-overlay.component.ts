import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { CartService } from '../../../../core/customer/services/cart.service';
import { CustomerAuthService } from '../../../../core/customer/services/customer-auth.service';
import { CustomerNavigationService } from '../../../../core/customer/services/customer-navigation.service';
import { guestSuccessImages } from '../assets/guest-success-assets';

/**
 * GuestOrderSuccessOverlay — chuyển từ React: src/components/checkout/GuestOrderSuccessOverlay.jsx
 */
@Component({
  selector: 'app-guest-order-success-overlay',
  standalone: true,
  imports: [],
  templateUrl: './guest-order-success-overlay.component.html',
  styleUrl: './guest-order-success-overlay.component.scss',
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
  // Guest không được cấp tài khoản/mật khẩu (M02): chỉ hiển thị mã đơn BE trả về và dẫn sang trang tra cứu bằng OTP.
  readonly orderCode = computed<string>(() => this.cartService.lastOrderResult()?.code || "");

  protected handleGoHome() {
    this.cartService.closeGuestSuccess();
    this.navService.navigate("/");
  }

  protected handleLookup() {
    this.cartService.closeGuestSuccess();
    this.navService.navigate("/tra-cuu-don-hang");
  }
}

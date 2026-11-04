import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { CartService } from '../../../../core/customer/services/cart.service';
import { CustomerNavigationService } from '../../../../core/customer/services/customer-navigation.service';
import { orderSuccessImages } from '../assets/order-success-assets';

/**
 * OrderSuccessOverlay — chuyển từ React: src/components/checkout/OrderSuccessOverlay.jsx
 */
@Component({
  selector: 'app-order-success-overlay',
  standalone: true,
  imports: [],
  templateUrl: './order-success-overlay.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderSuccessOverlayComponent {
  // --- Service dùng chung ---
  protected readonly cartService = inject(CartService);
  protected readonly navService = inject(CustomerNavigationService);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly orderSuccessImages: any = orderSuccessImages;

  protected handleGoHome() {
    this.cartService.closeOrderSuccess();
    this.navService.navigate("/");
  }

  protected handleOrderDetails() {
    this.cartService.closeOrderSuccess();
    const order = this.cartService.lastOrderResult();
    const orderId = order?.id || order?._id || order?.order_id || order?.orderId || order?.orderCode || order?.code;
    if (orderId) {
      this.navService.navigate(`/don-hang-cua-toi/${orderId}`);
    } else {
      this.navService.navigate('/don-hang-cua-toi');
    }
  }
}

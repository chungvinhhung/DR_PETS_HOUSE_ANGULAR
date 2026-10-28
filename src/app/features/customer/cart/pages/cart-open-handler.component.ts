import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { CartService } from '../../../../core/customer/services/cart.service';

/**
 * Route /cart — chuyển từ React: src/pages/Shop/CartOpenHandler.jsx
 * Mở giỏ hàng (dạng popup) rồi quay lại trang trước, giữ nguyên nội dung phía sau.
 */
@Component({
  selector: 'app-cart-open-handler',
  standalone: true,
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartOpenHandlerComponent implements OnInit {
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.cart.openCart();
    if (window.history.length > 1) {
      history.back();
    } else {
      void this.router.navigateByUrl('/', { replaceUrl: true });
    }
  }
}

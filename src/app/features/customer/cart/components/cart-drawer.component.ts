import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { CartService } from '../../../../core/customer/services/cart.service';
import { MyCartPanelComponent } from './my-cart-panel.component';

/**
 * CartDrawer — chuyển từ React: src/components/cart/CartDrawer.jsx
 */
@Component({
  selector: 'app-cart-drawer',
  standalone: true,
  imports: [MyCartPanelComponent],
  templateUrl: './cart-drawer.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartDrawerComponent {
  // --- Service dùng chung ---
  protected readonly cartService = inject(CartService);

}

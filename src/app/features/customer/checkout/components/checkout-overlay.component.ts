import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { CartService } from '../../../../core/customer/services/cart.service';
import { CheckoutComponent } from './checkout.component';

/**
 * CheckoutOverlay — chuyển từ React: src/components/checkout/CheckoutOverlay.jsx
 */
@Component({
  selector: 'app-checkout-overlay',
  standalone: true,
  imports: [CheckoutComponent],
  templateUrl: './checkout-overlay.component.html',
  styleUrl: './checkout-overlay.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutOverlayComponent {
  // --- Service dùng chung ---
  protected readonly cartService = inject(CartService);

}

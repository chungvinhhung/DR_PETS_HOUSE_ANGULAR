import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { CartService } from '../../../../core/customer/services/cart.service';

/**
 * PaymentModeToggle — chuyển từ React: src/components/checkout/ShoppingCheckout.jsx
 */
@Component({
  selector: 'div[app-payment-mode-toggle]',
  standalone: true,
  imports: [],
  templateUrl: './payment-mode-toggle.component.html',
  host: {
    'class': 'grid rounded-2xl bg-[#f2f4f6] p-1.5 text-center text-sm font-bold',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentModeToggleComponent {
  // --- Service dùng chung ---
  protected readonly cartService = inject(CartService);

  // --- Giá trị tính toán (computed) ---
  readonly isCod = computed<any>(() => this.cartService.paymentMode() === "cod");

}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { CartService } from '../../../../core/customer/services/cart.service';
import { ONLINE_PAYMENT_METHODS } from '../assets/checkout-assets';

/**
 * OnlinePaymentMethods — chuyển từ React: src/components/checkout/ShoppingCheckout.jsx
 */
@Component({
  selector: 'div[app-online-payment-methods]',
  standalone: true,
  imports: [],
  templateUrl: './online-payment-methods.component.html',
  styleUrl: './online-payment-methods.component.scss',
  host: {
    'class': 'space-y-3 rounded-2xl bg-[#f2f4f6] p-4',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnlinePaymentMethodsComponent {
  // --- Service dùng chung ---
  protected readonly cartService = inject(CartService);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly ONLINE_PAYMENT_METHODS: any = ONLINE_PAYMENT_METHODS;

}

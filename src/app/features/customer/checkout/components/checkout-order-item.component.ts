import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { checkoutImages } from '../assets/checkout-assets';
import { formatMoney } from './shopping-checkout.helpers';

/**
 * CheckoutOrderItem — chuyển từ React: src/components/checkout/ShoppingCheckout.jsx
 */
@Component({
  selector: 'div[app-checkout-order-item]',
  standalone: true,
  imports: [],
  templateUrl: './checkout-order-item.component.html',
  styleUrl: './checkout-order-item.component.scss',
  host: {
    'class': 'flex w-full items-center gap-4 rounded-2xl bg-[#f2f4f6] p-4',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutOrderItemComponent {
  // --- Input / Output (props của React) ---
  readonly item = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly checkoutImages: any = checkoutImages;
  protected readonly formatMoney: any = formatMoney;

}

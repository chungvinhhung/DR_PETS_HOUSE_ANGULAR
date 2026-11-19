import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { CheckoutOrderItemComponent } from './checkout-order-item.component';
import { ORDER_CODE } from '../assets/checkout-assets';

/**
 * OrderDetailsCard — chuyển từ React: src/components/checkout/ShoppingCheckout.jsx
 */
@Component({
  selector: 'section[app-order-details-card]',
  standalone: true,
  imports: [CheckoutOrderItemComponent],
  templateUrl: './order-details-card.component.html',
  styleUrl: './order-details-card.component.scss',
  host: {
    'class': 'flex flex-col gap-6 rounded-2xl bg-white p-8 shadow-[0_4px_13px_rgba(144,202,249,0.85)]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetailsCardComponent {
  // --- Input / Output (props của React) ---
  readonly items = input<any>(undefined);
  readonly note = input<any>(undefined);
  readonly onNoteChange = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly ORDER_CODE: any = ORDER_CODE;

}

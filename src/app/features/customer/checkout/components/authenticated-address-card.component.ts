import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { checkoutImages } from '../assets/checkout-assets';

/**
 * AuthenticatedAddressCard — chuyển từ React: src/components/checkout/ShoppingCheckout.jsx
 */
@Component({
  selector: 'section[app-authenticated-address-card]',
  standalone: true,
  imports: [],
  templateUrl: './authenticated-address-card.component.html',
  host: {
    'class': 'flex flex-col gap-4 rounded-2xl bg-white p-8 shadow-[0_4px_13px_rgba(144,202,249,0.85)]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthenticatedAddressCardComponent {
  // --- Input / Output (props của React) ---
  readonly onChange = output<any>();
  readonly address = input<any>(undefined);
  readonly loading = input<any>(undefined);
  readonly error = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly checkoutImages: any = checkoutImages;

  // --- Giá trị tính toán (computed) ---
  readonly displayAddress = computed<any>(() => this.address()?.displayAddress || this.address()?.address);

}

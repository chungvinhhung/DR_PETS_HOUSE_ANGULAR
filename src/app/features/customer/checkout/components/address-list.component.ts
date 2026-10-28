import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * AddressList — chuyển từ React: src/components/checkout/ShoppingCheckout.jsx
 */
@Component({
  selector: 'app-address-list',
  standalone: true,
  imports: [],
  templateUrl: './address-list.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressListComponent {
  // --- Input / Output (props của React) ---
  readonly addresses = input<any>(undefined);
  readonly onEdit = output<any>();
  readonly onSelect = output<any>();

}

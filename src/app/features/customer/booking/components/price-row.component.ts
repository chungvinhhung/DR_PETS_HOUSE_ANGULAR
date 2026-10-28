import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * PriceRow — chuyển từ React: src/components/booking/BookingPaymentStep.jsx
 */
@Component({
  selector: 'div[app-price-row]',
  standalone: true,
  imports: [],
  templateUrl: './price-row.component.html',
  host: {
    'class': 'flex justify-between font-medium text-slate-700',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceRowComponent {
  // --- Input / Output (props của React) ---
  readonly label = input<any>(undefined);
  readonly value = input<any>(undefined);

}

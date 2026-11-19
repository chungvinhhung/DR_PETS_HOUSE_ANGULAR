import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Detail — chuyển từ React: src/components/booking/BookingPaymentStep.jsx
 */
@Component({
  selector: 'div[app-detail]',
  standalone: true,
  imports: [],
  templateUrl: './detail.component.html',
  styleUrl: './detail.component.scss',
  host: {
    'class': 'rounded-2xl bg-[#f2f4f6] p-4',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailComponent {
  // --- Input / Output (props của React) ---
  readonly label = input<any>(undefined);
  readonly value = input<any>(undefined);
  readonly subValue = input<any>(undefined);
  readonly icon = input<any>(undefined);

}

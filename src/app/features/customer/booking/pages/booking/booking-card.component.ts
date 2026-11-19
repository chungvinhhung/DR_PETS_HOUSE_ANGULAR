import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * BookingCard — chuyển từ React: src/pages/Booking/BookingPage.jsx (component Card)
 */
@Component({
  selector: 'app-booking-card',
  standalone: true,
  imports: [],
  templateUrl: './booking-card.component.html',
  styleUrl: './booking-card.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingCardComponent {
  // --- Input / Output (props của React) ---
  readonly className = input<any>("");
  readonly title = input<any>(undefined);
  readonly dataBookingError = input<any>(undefined, { alias: 'data-booking-error' });
  readonly tabIndex = input<any>(undefined);

}

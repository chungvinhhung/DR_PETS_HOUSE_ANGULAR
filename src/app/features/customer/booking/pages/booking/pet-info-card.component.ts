import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { BookingCardComponent } from './booking-card.component';
import { BookingFieldComponent } from './booking-field.component';

/**
 * PetInfoCard — chuyển từ React: src/pages/Booking/BookingPage.jsx
 *
 * Ghi chú chuyển đổi:
 *  - output onChange được gọi với 3 tham số -> gộp thành mảng
 */
@Component({
  selector: 'app-pet-info-card',
  standalone: true,
  imports: [BookingCardComponent, BookingFieldComponent],
  templateUrl: './pet-info-card.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PetInfoCardComponent {
  // --- Input / Output (props của React) ---
  readonly petInfo = input<any>(undefined);
  readonly index = input<any>(undefined);
  readonly showIndex = input<any>(undefined);
  readonly canRemove = input<any>(undefined);
  readonly validationAttempted = input<any>(undefined);
  readonly onChange = output<any>();
  readonly onRemove = output<any>();

}

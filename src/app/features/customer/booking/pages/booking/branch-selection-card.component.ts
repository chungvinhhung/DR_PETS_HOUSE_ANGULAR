import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { BookingCardComponent } from './booking-card.component';
import { CustomerIconComponent } from '../../../../../shared/customer/components/icon/customer-icon.component';
import { SelectValueDirective } from '../../../../../shared/customer/directives/select-value.directive';

/**
 * BranchSelectionCard — chuyển từ React: src/pages/Booking/BookingPage.jsx
 */
@Component({
  selector: 'app-branch-selection-card',
  standalone: true,
  imports: [BookingCardComponent, CustomerIconComponent, SelectValueDirective],
  templateUrl: './branch-selection-card.component.html',
  styleUrl: './branch-selection-card.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchSelectionCardComponent {
  // --- Input / Output (props của React) ---
  readonly selectedBranch = input<any>(undefined);
  readonly onSelect = output<any>();
  readonly branches = input<any>(undefined);
  readonly invalid = input<any>(false);

}

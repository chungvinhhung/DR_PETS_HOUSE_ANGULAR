import { ChangeDetectionStrategy, Component, output } from '@angular/core';

/**
 * FlowButtons — chuyển từ React: src/pages/Booking/BookingPage.jsx
 */
@Component({
  selector: 'div[app-flow-buttons]',
  standalone: true,
  imports: [],
  templateUrl: './flow-buttons.component.html',
  host: {
    'class': 'mt-5 flex w-full items-center justify-between md:mt-6',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlowButtonsComponent {
  // --- Input / Output (props của React) ---
  readonly onBack = output<any>();
  readonly onNext = output<any>();

}

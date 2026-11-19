import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Card — chuyển từ React: src/components/booking/BookingPaymentStep.jsx
 */
@Component({
  selector: 'section[app-card]',
  standalone: true,
  imports: [],
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
  host: {
    '[class]': '`rounded-2xl bg-white shadow-[0_4px_13px_rgba(144,202,249,0.85)] ${className()}`',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardComponent {
  // --- Input / Output (props của React) ---
  readonly className = input<any>("");

}

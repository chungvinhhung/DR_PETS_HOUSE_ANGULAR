import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * PillInput — chuyển từ React: src/components/checkout/GuestCheckoutSections.jsx
 */
@Component({
  selector: 'app-pill-input',
  standalone: true,
  imports: [],
  templateUrl: './pill-input.component.html',
  styleUrl: './pill-input.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PillInputComponent {
  // --- Input / Output (props của React) ---
  readonly id = input<any>(undefined);
  readonly type = input<any>("text");
  readonly className = input<any>("");
  readonly name = input<any>(undefined);
  readonly autoComplete = input<any>(undefined);
  readonly value = input<any>(undefined);
  readonly onChange = output<any>();

}

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * OutlineButton — chuyển từ React: src/pages/Order/OrderPages.jsx
 */
@Component({
  selector: 'app-outline-button',
  standalone: true,
  imports: [],
  templateUrl: './outline-button.component.html',
  styleUrl: './outline-button.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OutlineButtonComponent {
  // --- Input / Output (props của React) ---
  readonly className = input<any>("");
  readonly onClick = output<any>();
  readonly disabled = input<any>(undefined);

}

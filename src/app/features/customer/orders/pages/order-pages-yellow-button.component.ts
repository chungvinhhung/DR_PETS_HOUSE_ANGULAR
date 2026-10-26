import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * OrderPagesYellowButton — chuyển từ React: src/pages/Order/OrderPages.jsx (component YellowButton)
 */
@Component({
  selector: 'app-order-pages-yellow-button',
  standalone: true,
  imports: [],
  templateUrl: './order-pages-yellow-button.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderPagesYellowButtonComponent {
  // --- Input / Output (props của React) ---
  readonly className = input<any>("");
  readonly onClick = output<any>();
  readonly disabled = input<any>(undefined);

}

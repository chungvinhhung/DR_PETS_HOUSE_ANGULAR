import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { CustomerLinkDirective } from '../../../../../shared/customer/directives/customer-link.directive';

/**
 * BookButton — chuyển từ React: src/components/groomingSpa/GroomingCombos.jsx
 */
@Component({
  selector: 'app-book-button',
  standalone: true,
  imports: [CustomerLinkDirective],
  templateUrl: './book-button.component.html',
  styleUrl: './book-button.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookButtonComponent {
  // --- Input / Output (props của React) ---
  readonly className = input<any>('');

}

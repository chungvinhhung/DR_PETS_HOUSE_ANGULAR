import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { CustomerIconComponent } from '../icon/customer-icon.component';

/**
 * CategoryIcon — chuyển từ React: src/components/blog/BlogCard.jsx
 */
@Component({
  selector: 'app-category-icon',
  standalone: true,
  imports: [CustomerIconComponent],
  templateUrl: './category-icon.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryIconComponent {
  // --- Input / Output (props của React) ---
  readonly category = input<any>(undefined);
  readonly className = input<any>("h-3 w-3");

}

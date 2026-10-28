import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { ReactStyleDirective } from '../../../../../shared/customer/directives/react-style.directive';
import { groomingImages } from '../../../../../shared/customer/assets/grooming-images';
import { cssMask } from '../../utils/grooming-mask.utils';

/**
 * ValuePropCard — chuyển từ React: src/components/groomingSpa/GroomingWhyUs.jsx
 */
@Component({
  selector: 'app-value-prop-card',
  standalone: true,
  imports: [ReactStyleDirective],
  templateUrl: './value-prop-card.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValuePropCardComponent {
  // --- Input / Output (props của React) ---
  readonly prop = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly cssMask: any = cssMask;
  protected readonly groomingImages: any = groomingImages;

}

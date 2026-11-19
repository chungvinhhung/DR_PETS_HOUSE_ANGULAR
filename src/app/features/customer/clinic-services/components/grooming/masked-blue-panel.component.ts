import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { ReactStyleDirective } from '../../../../../shared/customer/directives/react-style.directive';
import { cssMask } from '../../utils/grooming-mask.utils';

/**
 * MaskedBluePanel — chuyển từ React: src/components/groomingSpa/GroomingCombos.jsx
 */
@Component({
  selector: 'app-masked-blue-panel',
  standalone: true,
  imports: [ReactStyleDirective],
  templateUrl: './masked-blue-panel.component.html',
  styleUrl: './masked-blue-panel.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MaskedBluePanelComponent {
  // --- Input / Output (props của React) ---
  readonly maskUrl = input<any>(undefined);
  readonly maskSize = input<any>(undefined);
  readonly className = input<any>('');

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly cssMask: any = cssMask;

}

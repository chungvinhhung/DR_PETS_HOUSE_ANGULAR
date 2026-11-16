import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { ReactStyleDirective } from '../../directives/react-style.directive';

/**
 * CanvasLayout — chuyển từ React: src/components/layout/CanvasLayout.jsx
 */
@Component({
  selector: 'div[app-canvas-layout]',
  standalone: true,
  imports: [ReactStyleDirective],
  templateUrl: './canvas-layout.component.html',
  host: {
    'class': 'block w-full overflow-x-clip bg-white',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CanvasLayoutComponent {
  // --- Input / Output (props của React) ---
  readonly className = input<any>("");
  readonly minHeight = input<any>(undefined);

}

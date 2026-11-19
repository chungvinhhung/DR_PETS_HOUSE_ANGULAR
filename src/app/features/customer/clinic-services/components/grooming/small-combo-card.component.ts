import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { MaskedBluePanelComponent } from './masked-blue-panel.component';
import { BookButtonComponent } from './book-button.component';

/**
 * SmallComboCard — chuyển từ React: src/components/groomingSpa/GroomingCombos.jsx
 */
@Component({
  selector: 'article[app-small-combo-card]',
  standalone: true,
  imports: [MaskedBluePanelComponent, BookButtonComponent],
  templateUrl: './small-combo-card.component.html',
  styleUrl: './small-combo-card.component.scss',
  host: {
    'class': 'relative h-[220px] w-full overflow-visible',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SmallComboCardComponent {
  // --- Input / Output (props của React) ---
  readonly image = input<any>(undefined);
  readonly title = input<any>(undefined);
  readonly price = input<any>(undefined);
  readonly description = input<any>(undefined);
  readonly maskUrl = input<any>(undefined);

}

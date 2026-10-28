import { ChangeDetectionStrategy, Component } from '@angular/core';

import { MaskedBluePanelComponent } from './masked-blue-panel.component';
import { BookButtonComponent } from './book-button.component';
import { SmallComboCardComponent } from './small-combo-card.component';
import { ReactStyleDirective } from '../../../../../shared/customer/directives/react-style.directive';
import { groomingImages } from '../../../../../shared/customer/assets/grooming-images';
import { GROOMING_COMBO_STEPS } from '../../../../../shared/customer/data/grooming-data';
import { cssMask } from '../../utils/grooming-mask.utils';
import { groomingTitleStyles } from '../../utils/grooming-title-styles';

/**
 * GroomingCombos — chuyển từ React: src/components/groomingSpa/GroomingCombos.jsx
 */
@Component({
  selector: 'section[app-grooming-combos]',
  standalone: true,
  imports: [MaskedBluePanelComponent, BookButtonComponent, SmallComboCardComponent, ReactStyleDirective],
  templateUrl: './grooming-combos.component.html',
  host: {
    'class': 'relative z-10 h-[785px] w-[1440px] overflow-visible',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroomingCombosComponent {
  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly groomingImages: any = groomingImages;
  protected readonly groomingTitleStyles: any = groomingTitleStyles;
  protected readonly GROOMING_COMBO_STEPS: any = GROOMING_COMBO_STEPS;

  /** (tự sinh) SpreadElement không dùng trực tiếp được trong template */
  protected styles1(): any {
    return {
          ...cssMask(groomingImages.comboHeartsIcon, '70px 82px'),
          backgroundColor: '#0D47A1',
        };
  }
}

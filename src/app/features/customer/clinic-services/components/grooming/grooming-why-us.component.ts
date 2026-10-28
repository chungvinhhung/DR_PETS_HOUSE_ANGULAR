import { ChangeDetectionStrategy, Component } from '@angular/core';

import { ValuePropCardComponent } from './value-prop-card.component';
import { ReactStyleDirective } from '../../../../../shared/customer/directives/react-style.directive';
import { groomingImages } from '../../../../../shared/customer/assets/grooming-images';
import { GROOMING_VALUE_PROPS } from '../../../../../shared/customer/data/grooming-data';
import { groomingTitleStyles } from '../../utils/grooming-title-styles';

/**
 * GroomingWhyUs — chuyển từ React: src/components/groomingSpa/GroomingWhyUs.jsx
 */
@Component({
  selector: 'app-grooming-why-us',
  standalone: true,
  imports: [ValuePropCardComponent, ReactStyleDirective],
  templateUrl: './grooming-why-us.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroomingWhyUsComponent {
  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly groomingImages: any = groomingImages;
  protected readonly groomingTitleStyles: any = groomingTitleStyles;
  protected readonly GROOMING_VALUE_PROPS: any = GROOMING_VALUE_PROPS;

}

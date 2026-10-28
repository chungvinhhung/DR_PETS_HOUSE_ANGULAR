import { ChangeDetectionStrategy, Component } from '@angular/core';

import { ReactStyleDirective } from '../../../../../shared/customer/directives/react-style.directive';
import { CustomerLinkDirective } from '../../../../../shared/customer/directives/customer-link.directive';
import { groomingImages } from '../../../../../shared/customer/assets/grooming-images';
import { groomingTitleStyles } from '../../utils/grooming-title-styles';

/**
 * GroomingHero — chuyển từ React: src/components/groomingSpa/GroomingHero.jsx
 */
@Component({
  selector: 'section[app-grooming-hero]',
  standalone: true,
  imports: [ReactStyleDirective, CustomerLinkDirective],
  templateUrl: './grooming-hero.component.html',
  host: {
    'class': 'relative h-[690px] w-[1440px] overflow-hidden bg-white',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroomingHeroComponent {
  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly groomingTitleStyles: any = groomingTitleStyles;
  protected readonly groomingImages: any = groomingImages;

}

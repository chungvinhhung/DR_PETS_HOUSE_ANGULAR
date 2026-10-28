import { ChangeDetectionStrategy, Component } from '@angular/core';

import { CheckIconComponent } from './check-icon.component';
import { YellowButtonComponent } from '../../../../shared/customer/components/yellow-button/yellow-button.component';
import { ReactStyleDirective } from '../../../../shared/customer/directives/react-style.directive';
import { homeImages } from '../../../../shared/customer/assets/home-images';
import { HOME_FEATURES } from '../data/home-data';

/**
 * AboutSection — chuyển từ React: src/components/home/AboutSection.jsx
 */
@Component({
  selector: 'section[app-about-section]',
  standalone: true,
  imports: [CheckIconComponent, YellowButtonComponent, ReactStyleDirective],
  templateUrl: './about-section.component.html',
  host: {
    'id': 'về-chúng-tôi',
    'class': 'w-full bg-white py-12 md:py-[50px]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutSectionComponent {
  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly homeImages: any = homeImages;
  protected readonly HOME_FEATURES: any = HOME_FEATURES;

}

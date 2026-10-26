import { ChangeDetectionStrategy, Component } from '@angular/core';

import { YellowButtonComponent } from '../../../../shared/customer/components/yellow-button/yellow-button.component';
import { homeImages } from '../../../../shared/customer/assets/home-images';

/**
 * HeroSection — chuyển từ React: src/components/home/HeroSection.jsx
 */
@Component({
  selector: 'section[app-hero-section]',
  standalone: true,
  imports: [YellowButtonComponent],
  templateUrl: './hero-section.component.html',
  host: {
    'class': 'relative w-full overflow-hidden bg-white pt-6',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroSectionComponent {
  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly homeImages: any = homeImages;

}

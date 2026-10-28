import { ChangeDetectionStrategy, Component } from '@angular/core';

import { SectionTitleComponent } from '../../../../shared/customer/components/section-title/section-title.component';
import { ServiceSectionServiceCardComponent } from './service-section-service-card.component';
import { homeImages } from '../../../../shared/customer/assets/home-images';
import { HOME_SERVICES } from '../data/home-data';

/**
 * ServiceSection — chuyển từ React: src/components/home/ServiceSection.jsx
 */
@Component({
  selector: 'section[app-service-section]',
  standalone: true,
  imports: [SectionTitleComponent, ServiceSectionServiceCardComponent],
  templateUrl: './service-section.component.html',
  host: {
    'id': 'dịch-vụ-thú-y',
    'class': 'relative w-full overflow-hidden py-12 md:py-16',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceSectionComponent {
  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly homeImages: any = homeImages;
  protected readonly HOME_SERVICES: any = HOME_SERVICES;

}

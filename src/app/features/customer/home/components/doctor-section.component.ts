import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { CustomerAuthService } from '../../../../core/customer/services/customer-auth.service';
import { SectionTitleComponent } from '../../../../shared/customer/components/section-title/section-title.component';
import { YellowButtonComponent } from '../../../../shared/customer/components/yellow-button/yellow-button.component';
import { DoctorCardComponent } from './doctor-card.component';
import { CustomerLinkDirective } from '../../../../shared/customer/directives/customer-link.directive';
import { homeImages } from '../../../../shared/customer/assets/home-images';
import { HOME_DOCTORS } from '../data/home-data';

/**
 * DoctorSection — chuyển từ React: src/components/home/DoctorSection.jsx
 */
@Component({
  selector: 'section[app-doctor-section]',
  standalone: true,
  imports: [SectionTitleComponent, YellowButtonComponent, DoctorCardComponent, CustomerLinkDirective],
  templateUrl: './doctor-section.component.html',
  styleUrl: './doctor-section.component.scss',
  host: {
    'class': 'relative w-full overflow-hidden py-12 md:py-16',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoctorSectionComponent {
  // --- Service dùng chung ---
  protected readonly authService = inject(CustomerAuthService);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly homeImages: any = homeImages;
  protected readonly HOME_DOCTORS: any = HOME_DOCTORS;

}

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { CustomerLinkDirective } from '../../../../../shared/customer/directives/customer-link.directive';
import { medicalAssets } from '../../data/medical-treatment-data';

/**
 * MedicalHero — chuyển từ React: src/pages/Services/MedicalTreatmentPage.jsx
 */
@Component({
  selector: 'section[app-medical-hero]',
  standalone: true,
  imports: [CustomerLinkDirective],
  templateUrl: './medical-hero.component.html',
  styleUrl: './medical-hero.component.scss',
  host: {
    'class': 'medical-hero',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalHeroComponent {
  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly medicalAssets: any = medicalAssets;

}

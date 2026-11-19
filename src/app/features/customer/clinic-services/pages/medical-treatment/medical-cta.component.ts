import { ChangeDetectionStrategy, Component, output } from '@angular/core';

import { ReactStyleDirective } from '../../../../../shared/customer/directives/react-style.directive';
import { CustomerLinkDirective } from '../../../../../shared/customer/directives/customer-link.directive';
import { medicalAssets } from '../../data/medical-treatment-data';

/**
 * MedicalCta — chuyển từ React: src/pages/Services/MedicalTreatmentPage.jsx
 */
@Component({
  selector: 'section[app-medical-cta]',
  standalone: true,
  imports: [ReactStyleDirective, CustomerLinkDirective],
  templateUrl: './medical-cta.component.html',
  styleUrl: './medical-cta.component.scss',
  host: {
    'class': 'medical-cta',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalCtaComponent {
  // --- Input / Output (props của React) ---
  readonly onOpenPricing = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly medicalAssets: any = medicalAssets;

}

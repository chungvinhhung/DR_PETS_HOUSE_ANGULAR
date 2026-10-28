import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { ReactStyleDirective } from '../../../../../shared/customer/directives/react-style.directive';
import { medicalAssets } from '../../data/medical-treatment-data';

/**
 * MedicalServices — chuyển từ React: src/pages/Services/MedicalTreatmentPage.jsx
 */
@Component({
  selector: 'section[app-medical-services]',
  standalone: true,
  imports: [ReactStyleDirective],
  templateUrl: './medical-services.component.html',
  host: {
    'class': 'medical-services',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalServicesComponent {
  // --- Input / Output (props của React) ---
  readonly services = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly medicalAssets: any = medicalAssets;

}

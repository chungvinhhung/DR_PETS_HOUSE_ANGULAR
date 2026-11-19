import { ChangeDetectionStrategy, Component } from '@angular/core';

import { WhyItemComponent } from './why-item.component';
import { medicalAssets, medicalWhyItems } from '../../data/medical-treatment-data';

/**
 * MedicalWhy — chuyển từ React: src/pages/Services/MedicalTreatmentPage.jsx
 */
@Component({
  selector: 'section[app-medical-why]',
  standalone: true,
  imports: [WhyItemComponent],
  templateUrl: './medical-why.component.html',
  styleUrl: './medical-why.component.scss',
  host: {
    'class': 'medical-why',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalWhyComponent {
  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly medicalWhyItems: any = medicalWhyItems;
  protected readonly medicalAssets: any = medicalAssets;

}

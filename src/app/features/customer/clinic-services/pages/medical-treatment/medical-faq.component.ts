import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PetCareFaqSectionComponent } from '../../../../../shared/customer/components/pet-care-faq-section/pet-care-faq-section.component';
import { medicalAssets, medicalFaqs } from '../../data/medical-treatment-data';

/**
 * MedicalFaq — chuyển từ React: src/pages/Services/MedicalTreatmentPage.jsx
 */
@Component({
  selector: 'app-medical-faq',
  standalone: true,
  imports: [PetCareFaqSectionComponent],
  templateUrl: './medical-faq.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalFaqComponent {
  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly medicalFaqs: any = medicalFaqs;
  protected readonly medicalAssets: any = medicalAssets;

}

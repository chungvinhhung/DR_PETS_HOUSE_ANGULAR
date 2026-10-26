import { ChangeDetectionStrategy, Component } from '@angular/core';

import { PetCareFaqSectionComponent } from '../../../../../shared/customer/components/pet-care-faq-section/pet-care-faq-section.component';
import { groomingImages } from '../../../../../shared/customer/assets/grooming-images';
import { GROOMING_FAQS } from '../../../../../shared/customer/data/grooming-data';

/**
 * GroomingFAQ — chuyển từ React: src/components/groomingSpa/GroomingFAQ.jsx
 */
@Component({
  selector: 'app-grooming-faq',
  standalone: true,
  imports: [PetCareFaqSectionComponent],
  templateUrl: './grooming-faq.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroomingFAQComponent {
  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly GROOMING_FAQS: any = GROOMING_FAQS;
  protected readonly groomingImages: any = groomingImages;

}

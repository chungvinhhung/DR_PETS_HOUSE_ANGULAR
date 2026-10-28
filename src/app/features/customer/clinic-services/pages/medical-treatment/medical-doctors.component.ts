import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { CustomerLinkDirective } from '../../../../../shared/customer/directives/customer-link.directive';
import { medicalAssets, medicalDoctorPages } from '../../data/medical-treatment-data';

/**
 * MedicalDoctors — chuyển từ React: src/pages/Services/MedicalTreatmentPage.jsx
 */
@Component({
  selector: 'section[app-medical-doctors]',
  standalone: true,
  imports: [CustomerLinkDirective],
  templateUrl: './medical-doctors.component.html',
  host: {
    'class': 'medical-doctors',
    'aria-label': 'Đội ngũ bác sĩ thú y',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalDoctorsComponent {
  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly medicalAssets: any = medicalAssets;
  protected readonly medicalDoctorPages: any = medicalDoctorPages;

  // --- Trạng thái (signal = useState / useRef) ---
  readonly page = signal<any>(0);

  protected move(amount: any) {
    return this.page.update((current: any) =>
          (current + amount + medicalDoctorPages.length) %
          medicalDoctorPages.length);
  }
}

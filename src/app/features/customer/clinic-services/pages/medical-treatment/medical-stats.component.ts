import { ChangeDetectionStrategy, Component } from '@angular/core';

import { medicalAssets, medicalStats } from '../../data/medical-treatment-data';

/**
 * MedicalStats — chuyển từ React: src/pages/Services/MedicalTreatmentPage.jsx
 */
@Component({
  selector: 'section[app-medical-stats]',
  standalone: true,
  imports: [],
  templateUrl: './medical-stats.component.html',
  host: {
    'class': 'medical-stats',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalStatsComponent {
  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly medicalAssets: any = medicalAssets;
  protected readonly medicalStats: any = medicalStats;

}

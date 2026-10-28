import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { NavBarComponent } from '../../../../../layouts/customer/components/navbar/nav-bar.component';
import { ScaledCanvasLayoutComponent } from '../../../../../shared/customer/components/scaled-canvas-layout/scaled-canvas-layout.component';
import { MedicalCanvasComponent } from './medical-canvas.component';
import { ServicePricingModalComponent } from '../../components/service-pricing-modal/service-pricing-modal.component';

/**
 * MedicalTreatmentPage — chuyển từ React: src/pages/Services/MedicalTreatmentPage.jsx
 */
@Component({
  selector: 'div[app-medical-treatment-page]',
  standalone: true,
  imports: [NavBarComponent, ScaledCanvasLayoutComponent, MedicalCanvasComponent, ServicePricingModalComponent],
  templateUrl: './medical-treatment-page.component.html',
  host: {
    'class': 'min-h-screen bg-[#f5f5f5]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalTreatmentPageComponent {
  // --- Trạng thái (signal = useState / useRef) ---
  readonly isPricingOpen = signal<any>(false);

}

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { NavBarComponent } from '../../../../../layouts/customer/components/navbar/nav-bar.component';
import { ScaledCanvasLayoutComponent } from '../../../../../shared/customer/components/scaled-canvas-layout/scaled-canvas-layout.component';
import { GroomingCanvasComponent } from './grooming-canvas.component';
import { ServicePricingModalComponent } from '../../components/service-pricing-modal/service-pricing-modal.component';

/**
 * GroomingSpaPage — chuyển từ React: src/pages/Services/GroomingSpaPage.jsx
 */
@Component({
  selector: 'div[app-grooming-spa-page]',
  standalone: true,
  imports: [NavBarComponent, ScaledCanvasLayoutComponent, GroomingCanvasComponent, ServicePricingModalComponent],
  templateUrl: './grooming-spa-page.component.html',
  host: {
    'class': 'min-h-screen bg-[#f5f5f5]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroomingSpaPageComponent {
  // --- Trạng thái (signal = useState / useRef) ---
  readonly isPricingOpen = signal<any>(false);

}

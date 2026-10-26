import { ChangeDetectionStrategy, Component, output } from '@angular/core';

import { GroomingHeroComponent } from '../../components/grooming/grooming-hero.component';
import { GroomingServicesComponent } from '../../components/grooming/grooming-services.component';
import { GroomingBannerComponent } from '../../components/grooming/grooming-banner.component';
import { GroomingCombosComponent } from '../../components/grooming/grooming-combos.component';
import { GroomingWhyUsComponent } from '../../components/grooming/grooming-why-us.component';
import { GroomingFeedbackSectionComponent } from '../../components/grooming/grooming-feedback-section.component';
import { GroomingFAQComponent } from '../../components/grooming/grooming-faq.component';
import { FooterComponent } from '../../../../../layouts/customer/components/footer/footer.component';

/**
 * GroomingCanvas — chuyển từ React: src/pages/Services/GroomingSpaPage.jsx
 */
@Component({
  selector: 'app-grooming-canvas',
  standalone: true,
  imports: [GroomingHeroComponent, GroomingServicesComponent, GroomingBannerComponent, GroomingCombosComponent, GroomingWhyUsComponent, GroomingFeedbackSectionComponent, GroomingFAQComponent, FooterComponent],
  templateUrl: './grooming-canvas.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroomingCanvasComponent {
  // --- Input / Output (props của React) ---
  readonly onOpenPricing = output<any>();

}

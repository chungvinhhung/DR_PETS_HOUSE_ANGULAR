import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, inject, output, signal } from '@angular/core';

import { BookingApiService } from '../../../../../core/customer/services/api/booking-api.service';
import { MedicalHeroComponent } from './medical-hero.component';
import { MedicalServicesComponent } from './medical-services.component';
import { MedicalCtaComponent } from './medical-cta.component';
import { MedicalStatsComponent } from './medical-stats.component';
import { MedicalWhyComponent } from './medical-why.component';
import { MedicalDoctorsComponent } from './medical-doctors.component';
import { GroomingFeedbackSectionComponent } from '../../components/grooming/grooming-feedback-section.component';
import { MedicalFaqComponent } from './medical-faq.component';
import { FooterComponent } from '../../../../../layouts/customer/components/footer/footer.component';
import { medicalServices } from '../../data/medical-treatment-data';
import { normalizeMedicalServiceCard } from './medical-treatment-page.helpers';

/**
 * MedicalCanvas — chuyển từ React: src/pages/Services/MedicalTreatmentPage.jsx
 */
@Component({
  selector: 'app-medical-canvas',
  standalone: true,
  imports: [MedicalHeroComponent, MedicalServicesComponent, MedicalCtaComponent, MedicalStatsComponent, MedicalWhyComponent, MedicalDoctorsComponent, GroomingFeedbackSectionComponent, MedicalFaqComponent, FooterComponent],
  templateUrl: './medical-canvas.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalCanvasComponent {
  // --- Service dùng chung ---
  protected readonly bookingApi = inject(BookingApiService);
  private readonly destroyRef = inject(DestroyRef);

  // --- Input / Output (props của React) ---
  readonly onOpenPricing = output<any>();

  // --- Trạng thái (signal = useState / useRef) ---
  readonly services = signal<any>(medicalServices);

  constructor() {
    // useEffect(..., []) -> chạy 1 lần sau khi render
    afterNextRender(() => {
      const cleanup = (() => {
        let active = true

        this.bookingApi.getServices()
          .then((apiServices: any) => {
            if (!active || !apiServices.length) return
            const medicalApiServices = apiServices
              .filter((service: any) => service.serviceTypeId === 'clinic')
              .map(normalizeMedicalServiceCard)

            if (medicalApiServices.length) {
              this.services.set(medicalApiServices)
            }
          })
          .catch(() => {
            this.services.set(medicalServices)
          })

        return () => {
          active = false
        }
      })();
      if (typeof cleanup === 'function') this.destroyRef.onDestroy(cleanup);
    });
  }

}

import { ChangeDetectionStrategy, Component } from '@angular/core';

import { ServiceCardComponent } from './service-card.component';
import { ReactStyleDirective } from '../../../../../shared/customer/directives/react-style.directive';
import { groomingImages } from '../../../../../shared/customer/assets/grooming-images';
import { GROOMING_SERVICES } from '../../../../../shared/customer/data/grooming-data';
import { groomingTitleStyles } from '../../utils/grooming-title-styles';
import { POSITIONS } from './grooming-services.helpers';

/**
 * GroomingServices — chuyển từ React: src/components/groomingSpa/GroomingServices.jsx
 */
@Component({
  selector: 'app-grooming-services',
  standalone: true,
  imports: [ServiceCardComponent, ReactStyleDirective],
  templateUrl: './grooming-services.component.html',
  styleUrl: './grooming-services.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroomingServicesComponent {
  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly groomingTitleStyles: any = groomingTitleStyles;
  protected readonly groomingImages: any = groomingImages;
  protected readonly GROOMING_SERVICES: any = GROOMING_SERVICES;

  /** (tự sinh) function không dùng trực tiếp được trong template */
  protected compute1(service: any): any {
    return POSITIONS.find((p: any) => p.id === service.id);
  }
}

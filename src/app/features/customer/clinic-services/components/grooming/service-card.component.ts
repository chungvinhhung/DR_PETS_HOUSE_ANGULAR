import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { ReactStyleDirective } from '../../../../../shared/customer/directives/react-style.directive';
import { maskStyle } from './grooming-services.helpers';

/**
 * ServiceCard — chuyển từ React: src/components/groomingSpa/GroomingServices.jsx
 */
@Component({
  selector: 'div[app-service-card]',
  standalone: true,
  imports: [ReactStyleDirective],
  templateUrl: './service-card.component.html',
  styleUrl: './service-card.component.scss',
  host: {
    'class': 'group relative h-[422px] w-[355px] shrink-0 transition-[transform,filter] duration-300 ease-out hover:-translate-y-1 hover:drop-shadow-[0_12px_18px_rgba(13,71,161,0.18)]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceCardComponent {
  // --- Input / Output (props của React) ---
  readonly service = input<any>(undefined);

  // --- Giá trị tính toán (computed) ---
  readonly mask = computed<any>(() => maskStyle(this.service().mask));

}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { appointmentImages } from '../../../../../shared/customer/assets/appointment-images';
import { getAppointmentTimelineSteps } from '../../utils/appointment-display';

/**
 * Timeline — chuyển từ React: src/pages/Booking/AppointmentHistoryPage.jsx
 */
@Component({
  selector: 'div[app-timeline]',
  standalone: true,
  imports: [],
  templateUrl: './timeline.component.html',
  host: {
    'class': 'flex items-start justify-between px-2 py-5',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimelineComponent {
  // --- Input / Output (props của React) ---
  readonly appointment = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly appointmentImages: any = appointmentImages;

  // --- Giá trị tính toán (computed) ---
  readonly steps = computed<any>(() => getAppointmentTimelineSteps(this.appointment()));

}

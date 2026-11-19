import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { WriteReviewFormComponent } from '../../../products/components/write-review-form.component';

/**
 * ReviewModal — chuyển từ React: src/pages/Booking/AppointmentHistoryPage.jsx
 */
@Component({
  selector: 'div[app-review-modal]',
  standalone: true,
  imports: [WriteReviewFormComponent],
  templateUrl: './review-modal.component.html',
  styleUrl: './review-modal.component.scss',
  host: {
    'class': 'overlay-fade-in fixed inset-0 z-40 flex items-center justify-center bg-[rgba(6,16,90,0.2)] px-6 backdrop-blur-[2px]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewModalComponent {
  // --- Input / Output (props của React) ---
  readonly appointment = input<any>(undefined);
  readonly onClose = output<any>();
  readonly onSubmit = output<any>();

}

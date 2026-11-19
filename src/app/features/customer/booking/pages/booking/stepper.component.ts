import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { AssetIconComponent } from './asset-icon.component';
import { informationStepCheck } from './booking-page.helpers';

/**
 * Stepper — chuyển từ React: src/pages/Booking/BookingPage.jsx
 */
@Component({
  selector: 'div[app-stepper]',
  standalone: true,
  imports: [AssetIconComponent],
  templateUrl: './stepper.component.html',
  styleUrl: './stepper.component.scss',
  host: {
    'class': 'mx-auto flex w-full max-w-[320px] items-start justify-center px-0 py-5 md:max-w-[688px] md:px-0 lg:max-w-xl lg:px-4',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepperComponent {
  // --- Input / Output (props của React) ---
  readonly step = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly informationStepCheck: any = informationStepCheck;

  // --- Giá trị tính toán (computed) ---
  readonly steps = computed<any>(() => ["Lựa chọn dịch vụ", "Điền thông tin", "Thanh toán"]);

}

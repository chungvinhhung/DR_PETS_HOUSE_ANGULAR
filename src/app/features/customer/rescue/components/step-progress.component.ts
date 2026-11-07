import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { CustomerIconComponent } from '../../../../shared/customer/components/icon/customer-icon.component';
import { ReactStyleDirective } from '../../../../shared/customer/directives/react-style.directive';
import { ADOPTION_STEPS } from '../data/adoption-form-data';

/**
 * StepProgress — chuyển từ React: src/components/rescue/AdoptionApplicationModal.jsx
 */
@Component({
  selector: 'div[app-step-progress]',
  standalone: true,
  imports: [CustomerIconComponent, ReactStyleDirective],
  templateUrl: './step-progress.component.html',
  host: {
    'class': 'relative flex h-[88px] shrink-0 items-center justify-between overflow-hidden bg-[#E5F6FD] px-4 py-6 sm:px-10',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepProgressComponent {
  // --- Input / Output (props của React) ---
  readonly stepIndex = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly ADOPTION_STEPS: any = ADOPTION_STEPS;

}

import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { RadioQuestionComponent } from './radio-question.component';
import { LIVING_CONDITION_QUESTIONS } from '../data/adoption-form-data';

/**
 * LivingStep — chuyển từ React: src/components/rescue/AdoptionApplicationModal.jsx
 */
@Component({
  selector: 'div[app-living-step]',
  standalone: true,
  imports: [RadioQuestionComponent],
  templateUrl: './living-step.component.html',
  styleUrl: './living-step.component.scss',
  host: {
    'class': 'flex w-full flex-col gap-6',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LivingStepComponent {
  // --- Input / Output (props của React) ---
  readonly values = input<any>(undefined);
  readonly onChange = output<any>();
  readonly errors = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly LIVING_CONDITION_QUESTIONS: any = LIVING_CONDITION_QUESTIONS;

}

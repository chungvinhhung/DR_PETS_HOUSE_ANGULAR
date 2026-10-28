import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { TextareaQuestionComponent } from './textarea-question.component';
import { RadioQuestionComponent } from './radio-question.component';
import { CustomerIconComponent } from '../../../../shared/customer/components/icon/customer-icon.component';
import { ADOPTION_COMMITMENT_NOTE, COMMITMENT_QUESTIONS } from '../data/adoption-form-data';

/**
 * CommitmentStep — chuyển từ React: src/components/rescue/AdoptionApplicationModal.jsx
 */
@Component({
  selector: 'div[app-commitment-step]',
  standalone: true,
  imports: [TextareaQuestionComponent, RadioQuestionComponent, CustomerIconComponent],
  templateUrl: './commitment-step.component.html',
  host: {
    'class': 'flex w-full flex-col gap-6',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommitmentStepComponent {
  // --- Input / Output (props của React) ---
  readonly values = input<any>(undefined);
  readonly onChange = output<any>();
  readonly errors = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly COMMITMENT_QUESTIONS: any = COMMITMENT_QUESTIONS;
  protected readonly ADOPTION_COMMITMENT_NOTE: any = ADOPTION_COMMITMENT_NOTE;

}

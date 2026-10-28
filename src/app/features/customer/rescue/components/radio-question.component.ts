import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { RequiredMarkComponent } from './required-mark.component';
import { RadioPillComponent } from './radio-pill.component';
import { FieldErrorComponent } from './field-error.component';

/**
 * RadioQuestion — chuyển từ React: src/components/rescue/AdoptionApplicationModal.jsx
 */
@Component({
  selector: 'fieldset[app-radio-question]',
  standalone: true,
  imports: [RequiredMarkComponent, RadioPillComponent, FieldErrorComponent],
  templateUrl: './radio-question.component.html',
  host: {
    'class': 'flex w-full flex-col gap-4',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RadioQuestionComponent {
  // --- Input / Output (props của React) ---
  readonly question = input<any>(undefined);
  readonly value = input<any>(undefined);
  readonly onChange = output<any>();
  readonly error = input<any>(false);

  // --- Giá trị tính toán (computed) ---
  readonly framed = computed<any>(() => !this.question().compact);
  readonly invalid = computed<any>(() => Boolean(this.error()));

}

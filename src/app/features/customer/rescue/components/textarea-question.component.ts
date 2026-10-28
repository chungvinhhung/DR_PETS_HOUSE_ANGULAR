import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { RequiredMarkComponent } from './required-mark.component';
import { FieldErrorComponent } from './field-error.component';
import { invalidInputClass } from './adoption-application-modal.helpers';

/**
 * TextareaQuestion — chuyển từ React: src/components/rescue/AdoptionApplicationModal.jsx
 *
 * Ghi chú chuyển đổi:
 *  - output onChange được gọi với 2 tham số -> gộp thành mảng
 */
@Component({
  selector: 'div[app-textarea-question]',
  standalone: true,
  imports: [RequiredMarkComponent, FieldErrorComponent],
  templateUrl: './textarea-question.component.html',
  host: {
    'class': 'flex w-full flex-col gap-4 pb-[6px]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextareaQuestionComponent {
  // --- Input / Output (props của React) ---
  readonly question = input<any>(undefined);
  readonly value = input<any>(undefined);
  readonly onChange = output<any>();
  readonly error = input<any>(false);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly invalidInputClass: any = invalidInputClass;

  // --- Giá trị tính toán (computed) ---
  readonly invalid = computed<any>(() => Boolean(this.error()));

}

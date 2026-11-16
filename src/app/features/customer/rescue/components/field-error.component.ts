import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { FIELD_ERROR_MESSAGE } from './adoption-application-modal.helpers';

/**
 * FieldError — chuyển từ React: src/components/rescue/AdoptionApplicationModal.jsx
 */
@Component({
  selector: 'app-field-error',
  standalone: true,
  imports: [],
  templateUrl: './field-error.component.html',
  styleUrl: './field-error.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldErrorComponent {
  // --- Input / Output (props của React) ---
  readonly show = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly FIELD_ERROR_MESSAGE: any = FIELD_ERROR_MESSAGE;

}

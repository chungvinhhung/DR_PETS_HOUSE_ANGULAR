import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RequiredMarkComponent } from './required-mark.component';

/**
 * AdoptionApplicationModalFieldLabel — chuyển từ React: src/components/rescue/AdoptionApplicationModal.jsx (component FieldLabel)
 */
@Component({
  selector: 'label[app-adoption-application-modal-field-label]',
  standalone: true,
  imports: [RequiredMarkComponent],
  templateUrl: './adoption-application-modal-field-label.component.html',
  styleUrl: './adoption-application-modal-field-label.component.scss',
  host: {
    '[attr.for]': '`adoption-${field().name}`',
    'class': 'px-1 text-[14px] font-semibold leading-5 tracking-[0.28px] text-[rgba(0,0,0,0.87)]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdoptionApplicationModalFieldLabelComponent {
  // --- Input / Output (props của React) ---
  readonly field = input<any>(undefined);

}

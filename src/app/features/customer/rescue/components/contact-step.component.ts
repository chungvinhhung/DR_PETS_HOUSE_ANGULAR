import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { ContactFieldComponent } from './contact-field.component';
import { CONTACT_FIELDS } from '../data/adoption-form-data';

/**
 * ContactStep — chuyển từ React: src/components/rescue/AdoptionApplicationModal.jsx
 */
@Component({
  selector: 'div[app-contact-step]',
  standalone: true,
  imports: [ContactFieldComponent],
  templateUrl: './contact-step.component.html',
  host: {
    'class': 'grid w-full grid-cols-1 gap-4 sm:grid-cols-2',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactStepComponent {
  // --- Input / Output (props của React) ---
  readonly values = input<any>(undefined);
  readonly onChange = output<any>();
  readonly errors = input<any>(undefined);
  readonly addresses = input<any>(undefined);
  readonly addressMode = input<any>(undefined);
  readonly onAddressModeChange = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly CONTACT_FIELDS: any = CONTACT_FIELDS;

}

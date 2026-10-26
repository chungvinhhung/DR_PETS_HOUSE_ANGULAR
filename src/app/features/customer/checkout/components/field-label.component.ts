import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * FieldLabel — chuyển từ React: src/components/checkout/GuestCheckoutSections.jsx
 */
@Component({
  selector: 'label[app-field-label]',
  standalone: true,
  imports: [],
  templateUrl: './field-label.component.html',
  host: {
    'class': 'text-sm font-medium text-slate-900',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldLabelComponent {
  // --- Input / Output (props của React) ---
  readonly required = input<any>(false);

}

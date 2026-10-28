import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { FieldLabelComponent } from './field-label.component';
import { PillInputComponent } from './pill-input.component';
import { checkoutImages } from '../assets/checkout-assets';

/**
 * GuestShippingForm — chuyển từ React: src/components/checkout/GuestCheckoutSections.jsx
 */
@Component({
  selector: 'section[app-guest-shipping-form]',
  standalone: true,
  imports: [FieldLabelComponent, PillInputComponent],
  templateUrl: './guest-shipping-form.component.html',
  host: {
    'class': 'flex flex-col gap-5 rounded-2xl bg-white p-8 shadow-[0_4px_13px_rgba(144,202,249,0.85)]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuestShippingFormComponent {
  // --- Input / Output (props của React) ---
  readonly value = input<any>(undefined);
  readonly onChange = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly checkoutImages: any = checkoutImages;

  protected update(field: any) {
    return (event: any) => {
    this.onChange.emit({ ...this.value(), [field]: event.target.value });
  };
  }
}

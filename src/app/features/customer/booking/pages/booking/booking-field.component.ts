import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { CustomerIconComponent } from '../../../../../shared/customer/components/icon/customer-icon.component';
import { SelectValueDirective } from '../../../../../shared/customer/directives/select-value.directive';

/**
 * BookingField — chuyển từ React: src/pages/Booking/BookingPage.jsx (component Field)
 */
@Component({
  selector: 'label[app-booking-field]',
  standalone: true,
  imports: [CustomerIconComponent, SelectValueDirective],
  templateUrl: './booking-field.component.html',
  host: {
    '[class]': 'className()',
    '[attr.title]': 'invalid() ? \'Vui lòng điền thông tin\' : undefined',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingFieldComponent {
  // --- Input / Output (props của React) ---
  readonly label = input<any>(undefined);
  readonly required = input<any>(undefined);
  readonly asProp = input<any>(undefined, { alias: 'as' });
  readonly options = input<any>([]);
  readonly suffix = input<any>(undefined);
  readonly className = input<any>("");
  readonly defaultValue = input<any>("");
  readonly type = input<any>("text");
  readonly value = input<any>(undefined);
  readonly onChange = output<any>();
  readonly showError = input<any>(false);

  // --- Giá trị tính toán (computed) ---
  readonly invalid = computed<any>(() => this.showError() && this.required() && !String(this.value() ?? this.defaultValue() ?? "").trim());

}

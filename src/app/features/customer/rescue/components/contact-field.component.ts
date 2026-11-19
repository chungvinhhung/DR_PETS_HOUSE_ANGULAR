import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { AdoptionApplicationModalFieldLabelComponent } from './adoption-application-modal-field-label.component';
import { FieldErrorComponent } from './field-error.component';
import { CustomerIconComponent } from '../../../../shared/customer/components/icon/customer-icon.component';
import { SelectValueDirective } from '../../../../shared/customer/directives/select-value.directive';
import { inputClass, invalidInputClass, NEW_ADDRESS_VALUE } from './adoption-application-modal.helpers';

/**
 * ContactField — chuyển từ React: src/components/rescue/AdoptionApplicationModal.jsx
 *
 * Ghi chú chuyển đổi:
 *  - output onChange được gọi với 2 tham số -> gộp thành mảng
 */
@Component({
  selector: 'app-contact-field',
  standalone: true,
  imports: [AdoptionApplicationModalFieldLabelComponent, FieldErrorComponent, CustomerIconComponent, SelectValueDirective],
  templateUrl: './contact-field.component.html',
  styleUrl: './contact-field.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactFieldComponent {
  // --- Input / Output (props của React) ---
  readonly field = input<any>(undefined);
  readonly value = input<any>(undefined);
  readonly onChange = output<any>();
  readonly error = input<any>(false);
  readonly addresses = input<any>([]);
  readonly addressMode = input<any>(undefined);
  readonly onAddressModeChange = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly NEW_ADDRESS_VALUE: any = NEW_ADDRESS_VALUE;
  protected readonly inputClass: any = inputClass;
  protected readonly invalidInputClass: any = invalidInputClass;

  // --- Giá trị tính toán (computed) ---
  readonly invalid = computed<any>(() => Boolean(this.error()));
  readonly sharedProps = computed<any>(() => ({
    id: `adoption-${this.field().name}`,
    name: this.field().name,
    value: this.value(),
    onChange: (event: any) => this.onChange.emit([this.field().name, event.target.value]),
    "aria-invalid": this.invalid() || undefined,
    "data-adoption-error": this.invalid() ? "true" : undefined,
  }));

  protected handle1(event: any) {
    const nextValue = event.target.value;
    this.onAddressModeChange.emit(nextValue);
    if (nextValue === NEW_ADDRESS_VALUE) {
      this.onChange.emit([this.field().name, ""]);
      return;
    }
    const selectedAddress = this.addresses().find((address: any) => address.id === nextValue);
    this.onChange.emit([this.field().name, selectedAddress?.address ?? ""]);
  }
}

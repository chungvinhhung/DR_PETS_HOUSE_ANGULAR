import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/**
 * AddressFormField — chuyển từ React: src/components/address/AddressFormModal.jsx
 */
@Component({
  selector: 'label[app-address-form-field]',
  standalone: true,
  imports: [],
  templateUrl: './address-form-field.component.html',
  host: {
    '[class]': '`flex min-w-0 flex-col gap-[10px] ${className()}`',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressFormFieldComponent {
  // --- Input / Output (props của React) ---
  readonly label = input<any>(undefined);
  readonly required = input<any>(false);
  readonly className = input<any>("");
  readonly value = input<any>(undefined);
  readonly showError = input<any>(false);
  readonly autoFocus = input<any>(undefined);
  readonly autoComplete = input<any>(undefined);
  readonly onChange = output<any>();
  readonly type = input<any>(undefined);

  // --- Giá trị tính toán (computed) ---
  readonly invalid = computed<any>(() => this.showError() && this.required() && !String(this.value() ?? "").trim());

}

import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { CustomerIconComponent } from '../../../../shared/customer/components/icon/customer-icon.component';

/**
 * Field — chuyển từ React: src/components/auth/AuthModal.jsx
 */
@Component({
  selector: 'label[app-field]',
  standalone: true,
  imports: [CustomerIconComponent],
  templateUrl: './field.component.html',
  styleUrl: './field.component.scss',
  host: {
    '[class]': '`block text-sm ${isSoft() ? \'font-medium text-[#060B16]\' : \'font-semibold text-[rgba(0,0,0,0.87)]\'}`',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldComponent {
  // --- Input / Output (props của React) ---
  readonly label = input<any>(undefined);
  readonly name = input<any>(undefined);
  readonly value = input<any>(undefined);
  readonly onChange = output<any>();
  readonly type = input<any>("text");
  readonly required = input<any>(false);
  readonly hint = input<any>(undefined);
  readonly placeholder = input<any>(undefined);
  readonly Icon = input<any>(undefined, { alias: 'icon' });
  readonly error = input<any>("");
  readonly variant = input<any>("default");

  // --- Giá trị tính toán (computed) ---
  readonly isPassword = computed<any>(() => this.type() === "password");
  readonly invalid = computed<any>(() => Boolean(this.error()));
  readonly isSoft = computed<any>(() => this.variant() === "soft");

  // --- Trạng thái (signal = useState / useRef) ---
  readonly visible = signal<any>(false);

  protected handle1() {
    this.visible.update((current: any) => !current);
  }
}

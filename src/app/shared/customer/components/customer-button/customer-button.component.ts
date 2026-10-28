import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/**
 * CustomerButton — chuyển từ React: src/components/Button/ButtonComponent.jsx (component ButtonComponent)
 */
@Component({
  selector: 'button[app-customer-button]',
  standalone: true,
  imports: [],
  templateUrl: './customer-button.component.html',
  host: {
    '[attr.type]': 'type()',
    '(click)': 'onClick.emit($event)',
    '[disabled]': 'disabled() || loading()',
    '[attr.aria-busy]': 'loading() || undefined',
    '[class]': '[ \'rounded px-4 py-2 font-medium\', variants()[variant()] ?? variants().primary, loading() ? \'btn-loading\' : \'\', className() ].join(\' \')',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerButtonComponent {
  // --- Input / Output (props của React) ---
  readonly onClick = output<any>();
  readonly variant = input<any>("primary");
  readonly type = input<any>("button");
  readonly className = input<any>("");
  readonly disabled = input<any>(false);
  readonly loading = input<any>(false);

  // --- Giá trị tính toán (computed) ---
  readonly variants = computed<any>(() => ({
    primary: "btn-brand bg-primary text-white hover:bg-[#5BB8E8] focus-ring-brand",
    secondary:
      "btn-brand bg-gray-200 text-gray-800 hover:bg-gray-300 focus-ring-brand",
    danger:
      "btn-brand bg-red-500 text-white hover:bg-red-600 focus-ring-brand",
    outline:
      "btn-brand border-2 border-primary bg-white text-primary hover:bg-primary hover:text-white focus-ring-brand",
  }));

}

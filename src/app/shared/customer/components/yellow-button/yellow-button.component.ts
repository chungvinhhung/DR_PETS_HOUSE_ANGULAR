import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { CustomerLinkDirective } from '../../directives/customer-link.directive';
import { VARIANT_CLASS } from './yellow-button.helpers';

/**
 * YellowButton — chuyển từ React: src/components/home/YellowButton.jsx
 */
@Component({
  selector: 'app-yellow-button',
  standalone: true,
  imports: [NgTemplateOutlet, CustomerLinkDirective],
  templateUrl: './yellow-button.component.html',
  styleUrl: './yellow-button.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class YellowButtonComponent {
  // --- Input / Output (props của React) ---
  readonly variant = input<any>("filled");
  readonly className = input<any>("");
  readonly onClick = output<any>();
  readonly to = input<any>(undefined);
  readonly href = input<any>(undefined);
  readonly type = input<any>("button");
  readonly disabled = input<any>(false);
  readonly loading = input<any>(false);
  readonly ariaLabel = input<any>(undefined, { alias: 'aria-label' });

  // --- Giá trị tính toán (computed) ---
  readonly buttonClassName = computed<any>(() => [
    (VARIANT_CLASS as any)[this.variant()] ?? VARIANT_CLASS.filled,
    "focus-ring-brand",
    this.loading() ? "btn-loading" : "",
    this.className(),
  ].join(" "));

}

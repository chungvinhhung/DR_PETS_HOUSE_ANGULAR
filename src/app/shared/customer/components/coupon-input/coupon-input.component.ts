import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * CouponInput — chuyển từ React: src/components/ui/CouponInput.jsx
 */
@Component({
  selector: 'div[app-coupon-input]',
  standalone: true,
  imports: [],
  templateUrl: './coupon-input.component.html',
  host: {
    'class': 'flex flex-row items-start gap-[26px]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CouponInputComponent {
  // --- Input / Output (props của React) ---
  readonly value = input<any>(undefined);
  readonly onChange = output<any>();
  readonly onApply = output<any>();
  readonly error = input<any>(undefined);

}

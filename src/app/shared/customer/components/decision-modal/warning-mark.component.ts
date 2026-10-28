import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * WarningMark — chuyển từ React: src/components/shared/DecisionModal.jsx
 */
@Component({
  selector: 'div[app-warning-mark]',
  standalone: true,
  imports: [],
  templateUrl: './warning-mark.component.html',
  host: {
    'class': 'decision-modal__icon-wrap',
    'aria-hidden': 'true',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WarningMarkComponent {
  // --- Input / Output (props của React) ---
  readonly type = input<any>(undefined);

  // --- Giá trị tính toán (computed) ---
  readonly isSuccess = computed<any>(() => this.type() === "success");

}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * PrimaryButton — chuyển từ React: src/components/auth/AuthModal.jsx
 */
@Component({
  selector: 'button[app-primary-button]',
  standalone: true,
  imports: [],
  templateUrl: './primary-button.component.html',
  host: {
    'type': 'submit',
    '[disabled]': 'disabled()',
    'class': 'btn-yellow h-[43px] w-full disabled:opacity-50',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrimaryButtonComponent {
  // --- Input / Output (props của React) ---
  readonly disabled = input<any>(false);

}

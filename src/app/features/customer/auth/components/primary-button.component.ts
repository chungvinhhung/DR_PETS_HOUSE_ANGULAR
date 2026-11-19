import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'button[app-primary-button]',
  standalone: true,
  imports: [],
  templateUrl: './primary-button.component.html',
  styleUrl: './primary-button.component.scss',
  host: {
    'type': 'submit',
    'class': 'btn-yellow h-[43px] w-full disabled:opacity-50',
    '[disabled]': 'disabled()',
    '[attr.aria-disabled]': 'inactive() || null',
    '[class]': "inactive() ? 'cursor-not-allowed !border-gray-300 !bg-gray-300 !text-gray-500 !shadow-none' : ''",
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrimaryButtonComponent {
  readonly disabled = input<any>(false);
  readonly inactive = input<boolean>(false);
}
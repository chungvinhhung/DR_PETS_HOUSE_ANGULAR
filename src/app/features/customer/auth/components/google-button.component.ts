import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * GoogleButton — chuyển từ React: src/components/auth/AuthModal.jsx
 */
@Component({
  selector: 'button[app-google-button]',
  standalone: true,
  imports: [],
  templateUrl: './google-button.component.html',
  host: {
    'type': 'button',
    'class': 'focus-ring-brand flex h-[39px] w-full items-center justify-center gap-2 rounded-md border border-black bg-white text-sm font-medium',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoogleButtonComponent {
}

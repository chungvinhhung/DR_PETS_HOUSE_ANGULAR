import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Visual-only Google button (intentionally inactive for the current QA phase).
 * Keep the original icon and styling; never open a popup, send credentials,
 * submit the enclosing form, or display a notification on click.
 */
@Component({
  selector: 'button[app-google-button]',
  standalone: true,
  templateUrl: './google-button.component.html',
  styleUrl: './google-button.component.scss',
  host: {
    'type': 'button',
    'class': 'focus-ring-brand flex h-[39px] w-full items-center justify-center gap-2 rounded-md border border-black bg-white text-sm font-medium',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoogleButtonComponent {}

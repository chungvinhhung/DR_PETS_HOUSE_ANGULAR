import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Divider — chuyển từ React: src/components/auth/AuthModal.jsx
 */
@Component({
  selector: 'div[app-divider]',
  standalone: true,
  imports: [],
  templateUrl: './divider.component.html',
  styleUrl: './divider.component.scss',
  host: {
    'class': 'flex items-center gap-2 text-sm',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DividerComponent {
}

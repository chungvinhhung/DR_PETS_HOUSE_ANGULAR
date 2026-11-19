import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * CheckIcon — chuyển từ React: src/components/home/AboutSection.jsx
 */
@Component({
  selector: 'span[app-check-icon]',
  standalone: true,
  imports: [],
  templateUrl: './check-icon.component.html',
  styleUrl: './check-icon.component.scss',
  host: {
    'class': 'flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 border-secondary bg-secondary/20 text-secondary',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckIconComponent {
}

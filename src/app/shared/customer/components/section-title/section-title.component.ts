import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * SectionTitle — chuyển từ React: src/components/home/SectionTitle.jsx
 */
@Component({
  selector: 'div[app-section-title]',
  standalone: true,
  imports: [],
  templateUrl: './section-title.component.html',
  styleUrl: './section-title.component.scss',
  host: {
    '[class]': '`flex flex-col items-center gap-6 text-center ${className()}`',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionTitleComponent {
  // --- Input / Output (props của React) ---
  readonly subtitle = input<any>(undefined);
  readonly className = input<any>("");

}

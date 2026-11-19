import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * RichText — chuyển từ React: src/pages/Policy/PolicyPage.jsx
 */
@Component({
  selector: 'p[app-rich-text]',
  standalone: true,
  imports: [],
  templateUrl: './rich-text.component.html',
  styleUrl: './rich-text.component.scss',
  host: {
    '[class]': 'className()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RichTextComponent {
  // --- Input / Output (props của React) ---
  readonly parts = input<any>(undefined);
  readonly className = input<any>("");

}

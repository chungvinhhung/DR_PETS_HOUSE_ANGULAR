import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * FooterColumn — chuyển từ React: src/components/Footer/Footer.jsx
 */
@Component({
  selector: 'section[app-footer-column]',
  standalone: true,
  imports: [],
  templateUrl: './footer-column.component.html',
  styleUrl: './footer-column.component.scss',
  host: {
    '[class]': 'className()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterColumnComponent {
  // --- Input / Output (props của React) ---
  readonly title = input<any>(undefined);
  readonly className = input<any>("");

}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Author — chuyển từ React: src/pages/Blog/CommunityPage.jsx
 */
@Component({
  selector: 'div[app-author]',
  standalone: true,
  imports: [],
  templateUrl: './author.component.html',
  styleUrl: './author.component.scss',
  host: {
    'class': 'flex items-center gap-3',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorComponent {
  // --- Input / Output (props của React) ---
  readonly post = input<any>(undefined);
  readonly large = input<any>(false);

}

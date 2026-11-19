import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * TabletSocialLinks — chuyển từ React: src/components/Footer/Footer.jsx
 */
@Component({
  selector: 'div[app-tablet-social-links]',
  standalone: true,
  imports: [],
  templateUrl: './tablet-social-links.component.html',
  styleUrl: './tablet-social-links.component.scss',
  host: {
    'class': 'flex items-center gap-4 text-[#475569]',
    'aria-label': 'Mạng xã hội',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabletSocialLinksComponent {
}

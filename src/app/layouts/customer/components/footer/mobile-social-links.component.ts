import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * MobileSocialLinks — chuyển từ React: src/components/Footer/Footer.jsx
 */
@Component({
  selector: 'div[app-mobile-social-links]',
  standalone: true,
  imports: [],
  templateUrl: './mobile-social-links.component.html',
  host: {
    'class': 'flex flex-1 items-center gap-4 text-[#475569]',
    'aria-label': 'Mạng xã hội',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileSocialLinksComponent {
}

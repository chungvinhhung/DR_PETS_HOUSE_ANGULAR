import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import { CustomerNavigationService } from '../../../../core/customer/services/customer-navigation.service';
import { CustomerLinkDirective } from '../../../../shared/customer/directives/customer-link.directive';
import { NAV_LINKS } from '../../constants/navbar-menu-links';

/**
 * NavLinks — chuyển từ React: src/components/Navbar/NavLinks.jsx
 */
@Component({
  selector: 'nav[app-nav-links]',
  standalone: true,
  imports: [CustomerLinkDirective],
  templateUrl: './nav-links.component.html',
  styleUrl: './nav-links.component.scss',
  host: {
    '[class]': '`hidden flex-auto items-center justify-evenly gap-3 lg:flex xl:gap-[22px] ${className()}`',
    'aria-label': 'Menu chính',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavLinksComponent {
  // --- Service dùng chung ---
  protected readonly navService = inject(CustomerNavigationService);

  // --- Input / Output (props của React) ---
  readonly className = input<any>("");

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly NAV_LINKS: any = NAV_LINKS;

}

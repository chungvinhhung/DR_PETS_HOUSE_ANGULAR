import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { CartService } from '../../../../core/customer/services/cart.service';
import { NavLinksComponent } from './nav-links.component';
import { NavSearchBarComponent } from './nav-search-bar.component';
import { YellowButtonComponent } from '../../../../shared/customer/components/yellow-button/yellow-button.component';
import { NotificationBellComponent } from '../notifications/notification-bell.component';
import { NavUserMenuComponent } from './nav-user-menu.component';
import { homeImages } from '../../../../shared/customer/assets/home-images';
import { navbarImages } from '../../../../shared/customer/assets/navbar-images';

/**
 * NavBarAuthenticated — chuyển từ React: src/components/Navbar/NavBarAuthenticated.jsx
 */
@Component({
  selector: 'app-nav-bar-authenticated',
  standalone: true,
  imports: [NavLinksComponent, NavSearchBarComponent, YellowButtonComponent, NotificationBellComponent, NavUserMenuComponent],
  templateUrl: './nav-bar-authenticated.component.html',
  styleUrl: './nav-bar-authenticated.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavBarAuthenticatedComponent {
  // --- Service dùng chung ---
  protected readonly cartService = inject(CartService);

  // --- Input / Output (props của React) ---
  readonly avatarSrc = input<any>(undefined);
  readonly onLogout = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly homeImages: any = homeImages;
  protected readonly navbarImages: any = navbarImages;

}

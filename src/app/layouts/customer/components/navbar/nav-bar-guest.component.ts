import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { CartService } from '../../../../core/customer/services/cart.service';
import { CustomerAuthService } from '../../../../core/customer/services/customer-auth.service';
import { NavLinksComponent } from './nav-links.component';
import { NavSearchBarComponent } from './nav-search-bar.component';
import { YellowButtonComponent } from '../../../../shared/customer/components/yellow-button/yellow-button.component';
import { homeImages } from '../../../../shared/customer/assets/home-images';

const cartIcon = '/assets/customer/images/cart_icon.svg';

/**
 * NavBarGuest — chuyển từ React: src/components/Navbar/NavBarGuest.jsx
 */
@Component({
  selector: 'app-nav-bar-guest',
  standalone: true,
  imports: [NavLinksComponent, NavSearchBarComponent, YellowButtonComponent],
  templateUrl: './nav-bar-guest.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavBarGuestComponent {
  // --- Service dùng chung ---
  protected readonly cartService = inject(CartService);
  protected readonly authService = inject(CustomerAuthService);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly homeImages: any = homeImages;
  protected readonly cartIcon: any = cartIcon;

}

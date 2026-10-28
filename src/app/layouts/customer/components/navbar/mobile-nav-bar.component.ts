import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';

import { CartService } from '../../../../core/customer/services/cart.service';
import { CustomerAuthService } from '../../../../core/customer/services/customer-auth.service';
import { TabletSearchTriggerComponent } from './tablet-search-trigger.component';
import { SearchAssetIconComponent } from './search-asset-icon.component';
import { NotificationBellComponent } from '../notifications/notification-bell.component';
import { FigmaMenuIconComponent } from './figma-menu-icon.component';
import { MobileSearchPanelComponent } from './mobile-search-panel.component';
import { MobileMenuPanelComponent } from './mobile-menu-panel.component';
import { CustomerLinkDirective } from '../../../../shared/customer/directives/customer-link.directive';
import { homeImages } from '../../../../shared/customer/assets/home-images';
import { navbarImages } from '../../../../shared/customer/assets/navbar-images';

const cartIcon = '/assets/customer/images/cart_icon.svg';

/**
 * MobileNavBar — chuyển từ React: src/components/Navbar/MobileNavBar.jsx
 */
@Component({
  selector: 'app-mobile-nav-bar',
  standalone: true,
  imports: [TabletSearchTriggerComponent, SearchAssetIconComponent, NotificationBellComponent, FigmaMenuIconComponent, MobileSearchPanelComponent, MobileMenuPanelComponent, CustomerLinkDirective],
  templateUrl: './mobile-nav-bar.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileNavBarComponent {
  // --- Service dùng chung ---
  protected readonly cartService = inject(CartService);
  protected readonly authService = inject(CustomerAuthService);

  // --- Input / Output (props của React) ---
  readonly isAuthenticated = input<any>(undefined);
  readonly avatarSrc = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly homeImages: any = homeImages;
  protected readonly navbarImages: any = navbarImages;
  protected readonly cartIcon: any = cartIcon;

  // --- Giá trị tính toán (computed) ---
  readonly rightGroupClass = computed<any>(() => this.isAuthenticated()
      ? "flex flex-1 items-center justify-between pl-[35px] md:flex-none md:w-[210px] md:gap-[23.25px] md:pl-0 md:pr-[10px]"
      : "flex flex-1 items-center justify-end gap-[10.75px] pl-[35px] md:flex-none md:w-[210px] md:gap-[23.25px] md:pl-0 md:pr-[10px]");
  readonly avatar = computed<any>(() => this.avatarSrc() ?? navbarImages.avatarPlaceholder);

  // --- Trạng thái (signal = useState / useRef) ---
  readonly activePanel = signal<any>(null);

  protected closePanel() {
    return this.activePanel.set(null);
  }

  protected openMobileCart() {
    this.closePanel();
    this.cartService.openCart();
  }
}

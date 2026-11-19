import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { CustomerAuthService } from '../../../../core/customer/services/customer-auth.service';
import { CustomerLinkDirective } from '../../../../shared/customer/directives/customer-link.directive';
import { navbarImages } from '../../../../shared/customer/assets/navbar-images';
import { USER_MENU_LINKS, USER_MENU_LOGOUT } from '../../constants/user-menu-links';
import { linkClass } from './nav-user-menu.helpers';

/**
 * NavUserMenu — chuyển từ React: src/components/Navbar/NavUserMenu.jsx
 */
@Component({
  selector: 'div[app-nav-user-menu]',
  standalone: true,
  imports: [CustomerLinkDirective],
  templateUrl: './nav-user-menu.component.html',
  styleUrl: './nav-user-menu.component.scss',
  host: {
    'class': 'group relative shrink-0',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavUserMenuComponent {
  // --- Service dùng chung ---
  protected readonly authService = inject(CustomerAuthService);

  // --- Input / Output (props của React) ---
  readonly avatarSrc = input<any>(undefined);
  readonly onLogout = output<any>();
  /** true khi component cha có truyền (onLogout) — thay cho kiểm tra "if (onLogout)" của React */
  readonly hasOnLogout = input<boolean>(false);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly USER_MENU_LINKS: any = USER_MENU_LINKS;
  protected readonly linkClass: any = linkClass;
  protected readonly USER_MENU_LOGOUT: any = USER_MENU_LOGOUT;

  // --- Giá trị tính toán (computed) ---
  readonly avatar = computed<any>(() => this.avatarSrc() ?? navbarImages.avatarPlaceholder);

  protected handleLogout(e: any) {
    e.preventDefault();
    // React: (onLogout ?? logout)() -> đăng xuất qua CustomerAuthService
    this.authService.logout();
  }
}

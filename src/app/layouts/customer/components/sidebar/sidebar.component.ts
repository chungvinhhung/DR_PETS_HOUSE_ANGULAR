import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { CustomerNavigationService } from '../../../../core/customer/services/customer-navigation.service';
import { CustomerAuthService } from '../../../../core/customer/services/customer-auth.service';
import { CustomerIconComponent } from '../../../../shared/customer/components/icon/customer-icon.component';
import { ReactStyleDirective } from '../../../../shared/customer/directives/react-style.directive';
import { USER_MENU_LINKS } from '../../constants/user-menu-links';

/**
 * Sidebar — chuyển từ React: src/components/Sidebar/Sidebar.jsx
 */
@Component({
  selector: 'div[app-sidebar]',
  standalone: true,
  imports: [CustomerIconComponent, ReactStyleDirective],
  templateUrl: './sidebar.component.html',
  host: {
    'class': 'w-[342px] flex-shrink-0 bg-[#e5f6fd] border-r border-[#c1c6d5]/30 h-full flex flex-col py-8 px-4 z-10 relative',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  // --- Service dùng chung ---
  protected readonly navService = inject(CustomerNavigationService);
  protected readonly authService = inject(CustomerAuthService);

  // --- Giá trị tính toán (computed) ---
  readonly menuIcons = computed<any>(() => ({
    "Thông tin người dùng": 'ant-user',
    "Quản lý thú cưng": 'paw-filled',
    "Lịch sử đặt lịch": 'ant-calendar',
    "Đơn hàng của tôi": 'ant-shopping',
  }));
  readonly menuItems = computed<any>(() => [
    ...USER_MENU_LINKS.map((item: any) => ({
      id: item.href,
      label: item.label,
      icon: (this.menuIcons() as any)[item.label],
      path: item.href,
    })),
  ]);

  protected isActive(path: any) {
    return this.navService.location().pathname === path || this.navService.location().pathname.startsWith(path + "/");
  }

  protected handleLogout() {
    this.authService.logout();
    this.navService.navigate("/");
  }
}

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
  styleUrl: './sidebar.component.scss',
  host: {
    'class': 'w-full lg:w-[250px] lg:max-w-[250px] flex-shrink-0 bg-[#e5f6fd] border-b lg:border-b-0 lg:border-r border-[#c1c6d5]/30 lg:h-full flex flex-row items-center gap-2 lg:flex-col lg:items-stretch lg:gap-0 py-2 lg:py-8 px-2 sm:px-4 z-10 relative',
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

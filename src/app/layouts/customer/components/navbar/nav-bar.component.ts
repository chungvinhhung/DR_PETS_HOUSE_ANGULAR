import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { CustomerAuthService } from '../../../../core/customer/services/customer-auth.service';
import { MobileNavBarComponent } from './mobile-nav-bar.component';
import { NavBarAuthenticatedComponent } from './nav-bar-authenticated.component';
import { NavBarGuestComponent } from './nav-bar-guest.component';

/**
 * NavBar — chuyển từ React: src/components/Navbar/NavBar.jsx
 */
@Component({
  selector: 'app-nav-bar',
  standalone: true,
  imports: [MobileNavBarComponent, NavBarAuthenticatedComponent, NavBarGuestComponent],
  templateUrl: './nav-bar.component.html',
  styleUrl: './nav-bar.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavBarComponent {
  // --- Service dùng chung ---
  protected readonly authService = inject(CustomerAuthService);

  // --- Input / Output (props của React) ---
  readonly avatarSrc = input<any>(undefined);
  readonly onLogout = output<any>();
  /** true khi component cha có truyền (onLogout) — thay cho kiểm tra "if (onLogout)" của React */
  readonly hasOnLogout = input<boolean>(false);

}

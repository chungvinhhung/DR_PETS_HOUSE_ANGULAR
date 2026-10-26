import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { CustomerAuthService } from '../../../../core/customer/services/customer-auth.service';
import { ReactStyleDirective } from '../../../../shared/customer/directives/react-style.directive';

/**
 * GuestLoginBanner — chuyển từ React: src/components/checkout/GuestCheckoutSections.jsx
 */
@Component({
  selector: 'section[app-guest-login-banner]',
  standalone: true,
  imports: [ReactStyleDirective],
  templateUrl: './guest-login-banner.component.html',
  host: {
    'class': 'flex min-h-[73px] items-center justify-between gap-4 rounded-2xl bg-white p-6 shadow-[0_4px_13px_rgba(144,202,249,0.85)]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuestLoginBannerComponent {
  // --- Service dùng chung ---
  protected readonly authService = inject(CustomerAuthService);

}

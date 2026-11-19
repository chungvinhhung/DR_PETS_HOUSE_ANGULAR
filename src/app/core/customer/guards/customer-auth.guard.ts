import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { RETURN_URL_PARAM } from '../../utils/return-url';
import { AUTH_MODAL_PARAM, CustomerAuthService } from '../services/customer-auth.service';

/**
 * Bảo vệ các trang cần đăng nhập của khách hàng (thay cho routes/ProtectedRoute.jsx).
 *
 * REDIRECT AFTER LOGIN / RETURN URL (Nhiệm vụ 13):
 *  - Đang dùng app rồi bấm vào trang cần đăng nhập -> mở popup tại chỗ, đăng nhập xong tự chuyển tới trang đó.
 *  - Vào thẳng URL (gõ địa chỉ, F5, link chia sẻ) -> chuyển về /?auth=login&returnUrl=<trang yêu cầu>.
 *    Trang đích nằm trên URL nên F5 / mở tab mới vẫn không mất; CustomerLayout đọc 2 tham số này để mở popup.
 */
export const customerAuthGuard: CanActivateFn = (_route, state) => {
  const auth = inject(CustomerAuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;

  if (router.navigated) {
    auth.loginWithReturnUrl(state.url, { replaceUrl: false });
    return false;
  }
  return router.createUrlTree(['/'], {
    queryParams: { [AUTH_MODAL_PARAM]: 'login', [RETURN_URL_PARAM]: state.url },
  });
};

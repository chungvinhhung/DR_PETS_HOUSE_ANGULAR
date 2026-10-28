import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { CustomerAuthService } from '../services/customer-auth.service';

/**
 * Bảo vệ các trang cần đăng nhập của khách hàng (thay cho routes/ProtectedRoute.jsx).
 *
 * Chưa đăng nhập -> mở popup đăng nhập; đăng nhập xong sẽ tự chuyển tới trang đã yêu cầu.
 * Nếu người dùng vào thẳng URL (lần điều hướng đầu tiên) thì đưa về trang chủ để popup có chỗ hiển thị.
 */
export const customerAuthGuard: CanActivateFn = (_route, state) => {
  const auth = inject(CustomerAuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;

  auth.requireAuth(() => void router.navigateByUrl(state.url));
  return router.navigated ? false : router.createUrlTree(['/']);
};

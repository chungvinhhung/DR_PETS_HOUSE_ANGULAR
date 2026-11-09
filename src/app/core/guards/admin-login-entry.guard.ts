import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

import { AuthRestoreService } from '../services/auth-restore.service';
import { AuthSessionService } from '../services/auth-session.service';

const BACKOFFICE_ROLES = ['ADMIN', 'MANAGER', 'STAFF'];

/**
 * Customer authentication and Backoffice authentication share the core session.
 * A CUSTOMER login must never be mistaken for a logged-in Admin, or routed
 * to /admin/dashboard where it would show an unnecessary 403.
 */
export const adminLoginEntryGuard: CanActivateFn = (_route, state) => {
  const authSession = inject(AuthSessionService);
  const authRestore = inject(AuthRestoreService);
  const router = inject(Router);

  // Explicit "Đăng nhập tài khoản khác" must always be available, including
  // when a Customer or a Backoffice account is already signed in.
  // Do not wait for /auth/refresh on a possibly sleeping API.
  if (state.url.startsWith('/admin/login')) {
    return true;
  }

  const backofficeLanding = () =>
    router.createUrlTree([
      authSession.hasAnyRole(['ADMIN', 'MANAGER'])
        ? '/admin/dashboard'
        : '/admin/appointments',
    ]);

  if (authSession.isAuthenticated()) {
    return authSession.hasAnyRole(BACKOFFICE_ROLES)
      ? backofficeLanding()
      : true; // Customer sees the Admin login form, not the 403 page.
  }

  // On a browser refresh the access token may be in an HttpOnly refresh
  // cookie. Restore first, but only auto-enter when the role is Backoffice.
  return authRestore.ensureSession().pipe(
    map((restored) =>
      restored && authSession.hasAnyRole(BACKOFFICE_ROLES)
        ? backofficeLanding()
        : true,
    ),
  );
};

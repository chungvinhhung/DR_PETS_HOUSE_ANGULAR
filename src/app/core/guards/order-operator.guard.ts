import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthSessionService } from '../services/auth-session.service';

/**
 * Admin sales workflow is limited to ADMIN, MANAGER and receptionist STAFF.
 * BE must still validate each request and enforce branch authorization.
 */
export const orderOperatorGuard: CanActivateFn = () => {
  const session = inject(AuthSessionService);
  const router = inject(Router);
  const user = session.user();
  const allowed = user?.systemRole === 'ADMIN' || user?.systemRole === 'MANAGER' ||
    (user?.systemRole === 'STAFF' && user.staffSubRole === 'RECEPTIONIST');
  return allowed ? true : router.createUrlTree(['/admin/forbidden']);
};

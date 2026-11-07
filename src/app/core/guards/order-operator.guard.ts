import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthRestoreService } from '../services/auth-restore.service';
import { AuthSessionService } from '../services/auth-session.service';

/**
 * Only ADMIN, MANAGER and receptionist STAFF can enter Order/Return admin screens.
 * Await session restoration after page refresh (guards may run concurrently).
 * BE must still enforce this policy and authorized branch scope.
 */
export const orderOperatorGuard: CanActivateFn = (_route, state) => {
  const session = inject(AuthSessionService);
  const restore = inject(AuthRestoreService);
  const router = inject(Router);
  const check = () => {
    const user = session.user();
    return user?.systemRole === 'ADMIN' || user?.systemRole === 'MANAGER' ||
      (user?.systemRole === 'STAFF' && user.staffSubRole === 'RECEPTIONIST');
  };
  if (session.user()) {
    return check() ? true : router.createUrlTree(['/admin/forbidden']);
  }
  return restore.ensureSession().pipe(map(ok => {
    if (!ok) return router.createUrlTree(['/admin/login'], { queryParams: { returnUrl: state.url } });
    return check() ? true : router.createUrlTree(['/admin/forbidden']);
  }));
};

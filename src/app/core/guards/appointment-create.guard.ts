import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

import { AuthRestoreService } from '../services/auth-restore.service';
import { AuthSessionService } from '../services/auth-session.service';

/**
 * Internal appointment creation is limited to ADMIN, MANAGER and receptionist STAFF.
 * BE remains authoritative for role and branch-scope enforcement.
 */
export const appointmentCreateGuard: CanActivateFn = (_route, state) => {
  const session = inject(AuthSessionService);
  const restore = inject(AuthRestoreService);
  const router = inject(Router);

  const allowed = () => {
    const user = session.user();
    return user?.systemRole === 'ADMIN' ||
      user?.systemRole === 'MANAGER' ||
      (user?.systemRole === 'STAFF' && user.staffSubRole === 'RECEPTIONIST');
  };

  if (session.user()) {
    return allowed() ? true : router.createUrlTree(['/admin/forbidden']);
  }

  return restore.ensureSession().pipe(map(ok => {
    if (!ok) {
      return router.createUrlTree(['/admin/login'], {
        queryParams: { returnUrl: state.url },
      });
    }
    return allowed() ? true : router.createUrlTree(['/admin/forbidden']);
  }));
};

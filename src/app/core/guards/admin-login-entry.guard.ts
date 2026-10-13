import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';

import { AuthRestoreService } from '../services/auth-restore.service';
import { AuthSessionService } from '../services/auth-session.service';

export const adminLoginEntryGuard: CanActivateFn = () => {
  const authSession = inject(AuthSessionService);
  const authRestore = inject(AuthRestoreService);
  const router = inject(Router);

  if (authSession.isAuthenticated()) {
    return router.createUrlTree(['/admin/dashboard']);
  }

  return authRestore.ensureSession().pipe(
    map((restored) =>
      restored ? router.createUrlTree(['/admin/dashboard']) : true,
    ),
  );
};

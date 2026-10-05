import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthSessionService } from '../services/auth-session.service';

export const roleGuard: CanActivateFn = (route) => {
  const authSession = inject(AuthSessionService);
  const router = inject(Router);

  if (!authSession.isAuthenticated()) {
    return router.createUrlTree(['/'], {
      queryParams: {
        authRequired: '1',
      },
    });
  }

  const configuredRoles = route.data['roles'];

  if (!Array.isArray(configuredRoles) || configuredRoles.length === 0) {
    return true;
  }

  const requiredRoles = configuredRoles.filter(
    (role): role is string => typeof role === 'string',
  );

  return authSession.hasAnyRole(requiredRoles)
    ? true
    : router.createUrlTree(['/'], {
        queryParams: {
          forbidden: '1',
        },
      });
};

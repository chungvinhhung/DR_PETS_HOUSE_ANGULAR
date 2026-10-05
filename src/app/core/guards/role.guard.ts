import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

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

  if (configuredRoles === undefined) {
    return true;
  }

  if (!isValidRoleConfiguration(configuredRoles)) {
    return forbiddenRedirect(router);
  }

  return authSession.hasAnyRole(configuredRoles)
    ? true
    : forbiddenRedirect(router);
};

function isValidRoleConfiguration(
  configuredRoles: unknown,
): configuredRoles is string[] {
  return (
    Array.isArray(configuredRoles) &&
    configuredRoles.length > 0 &&
    configuredRoles.every(
      (role) => typeof role === 'string' && role.trim().length > 0,
    )
  );
}

function forbiddenRedirect(router: Router): UrlTree {
  return router.createUrlTree(['/'], {
    queryParams: {
      forbidden: '1',
    },
  });
}

import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { environment } from '../../../environments/environment';
import { AuthSessionService } from '../services/auth-session.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authSession = inject(AuthSessionService);
  const token = authSession.accessToken();

  if (!token || !isApiRequest(request.url)) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    }),
  );
};

function isApiRequest(url: string): boolean {
  const apiBaseUrl = environment.apiBaseUrl.trim().replace(/\/+$/, '');

  return Boolean(apiBaseUrl) && url.startsWith(apiBaseUrl);
}

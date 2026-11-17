import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { AppHttpError } from '../models/app-http-error.model';
import { AuthSessionService } from '../services/auth-session.service';
import { AuthTokenRefreshService } from '../services/auth-token-refresh.service';
import { RETURN_URL_PARAM } from '../utils/return-url';

export const refreshTokenInterceptor: HttpInterceptorFn = (request, next) => {
  const authSession = inject(AuthSessionService);
  const tokenRefresh = inject(AuthTokenRefreshService);
  const router = inject(Router);

  if (isRefreshRequest(request.url)) {
    return next(request);
  }

  return next(request).pipe(
    catchError((error: unknown) => {
      if (!isTokenExpiredError(error)) {
        return throwError(() => error);
      }

      return tokenRefresh.refreshAccessToken().pipe(
        switchMap((accessToken) =>
          next(
            request.clone({
              setHeaders: {
                Authorization: `Bearer ${accessToken}`,
              },
            }),
          ),
        ),
        catchError((refreshError: unknown) => {
          // A temporary network/server outage is not an invalid refresh cookie.
          // Preserve the session so a later request can retry authentication.
          if (!isTransientRefreshError(refreshError)) {
            authSession.clearSession();
            redirectToLogin(router);
          }
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};

/**
 * Hết phiên: trang quản trị -> /admin/login?returnUrl=<trang đang xem> (đăng nhập lại quay về đúng chỗ);
 * trang khách hàng -> mở popup đăng nhập của khách, KHÔNG đẩy sang trang login admin.
 */
function redirectToLogin(router: Router): void {
  const currentUrl = router.url;
  if (currentUrl.startsWith('/admin')) {
    if (currentUrl.startsWith('/admin/login')) return;
    void router.navigate(['/admin/login'], { queryParams: { [RETURN_URL_PARAM]: currentUrl } });
    return;
  }
  window.dispatchEvent(new CustomEvent('petclinic:auth-expired'));
}

function isRefreshRequest(url: string): boolean {
  return /\/auth\/refresh(?:$|[?#])/.test(url);
}

function isTokenExpiredError(error: unknown): boolean {
  if (error instanceof AppHttpError) {
    return (
      error.status === 401 &&
      backendErrorCode(error.details) === 'TOKEN_EXPIRED'
    );
  }

  if (error instanceof HttpErrorResponse) {
    return error.status === 401 && backendErrorCode(error.error) === 'TOKEN_EXPIRED';
  }

  return false;
}

function backendErrorCode(details: unknown): string | null {
  if (
    typeof details === 'object' &&
    details !== null &&
    'code' in details &&
    typeof (details as { code?: unknown }).code === 'string'
  ) {
    return (details as { code: string }).code;
  }

  return null;
}

function isTransientRefreshError(error: unknown): boolean {
  if (error instanceof AppHttpError || error instanceof HttpErrorResponse) {
    return error.status === 0 || [502, 503, 504].includes(error.status);
  }
  return error instanceof Error && error.name === 'TimeoutError';
}

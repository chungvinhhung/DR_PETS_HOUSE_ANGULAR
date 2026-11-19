import { HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthSessionService } from '../services/auth-session.service';
import { AuthTokenRefreshService } from '../services/auth-token-refresh.service';
import { isJwtExpired } from '../utils/jwt';

/**
 * BEARER TOKEN (Nhiệm vụ 14): gắn `Authorization: Bearer <accessToken>` cho request tới backend.
 *
 *  - Chỉ gắn cho URL thuộc environment.apiBaseUrl -> token không bị gửi lộ sang domain khác (CDN ảnh, Google...).
 *  - Không gắn cho /auth/login, /auth/refresh.
 *  - Token JWT đã/sắp hết hạn (exp, lệch 30s) -> làm mới trước qua /auth/refresh (cookie httpOnly) rồi mới gửi,
 *    tránh 1 vòng request hỏng 401. Làm mới lỗi -> vẫn gửi token cũ để refreshTokenInterceptor xử lý 401 như thường.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const authSession = inject(AuthSessionService);
  const tokenRefresh = inject(AuthTokenRefreshService);
  const token = authSession.accessToken();

  if (
    !token ||
    !isApiRequest(request.url) ||
    isPublicAuthRequest(request.url)
  ) {
    return next(request);
  }

  if (isJwtExpired(token)) {
    return tokenRefresh.refreshAccessToken().pipe(
      catchError(() => [token]),
      switchMap((accessToken) => sendWithBearer(request, next, accessToken)),
    );
  }

  return sendWithBearer(request, next, token);
};

function sendWithBearer(request: HttpRequest<unknown>, next: HttpHandlerFn, token: string) {
  return next(
    request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    }),
  );
}

function isApiRequest(url: string): boolean {
  const apiBaseUrl = environment.apiBaseUrl.trim().replace(/\/+$/, '');

  if (!apiBaseUrl) {
    return false;
  }

  return (
    url === apiBaseUrl ||
    url.startsWith(`${apiBaseUrl}/`) ||
    url.startsWith(`${apiBaseUrl}?`)
  );
}

function isPublicAuthRequest(url: string): boolean {
  return /\/auth\/(?:login|refresh)(?:$|[?#])/.test(url);
}

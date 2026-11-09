import { inject, Injectable } from '@angular/core';
import { finalize, Observable, tap } from 'rxjs';

import {
  LoginRequest,
  LoginResponse,
} from '../../../../core/models/auth.model';
import { ApiClientService } from '../../../../core/services/api-client.service';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AppHttpError } from '../../../../core/models/app-http-error.model';

@Injectable({
  providedIn: 'root',
})
export class AdminAuthService {
  private readonly api = inject(ApiClientService);
  private readonly authSession = inject(AuthSessionService);

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.api
      .post<LoginResponse, LoginRequest>('/auth/login', request)
      .pipe(
        tap((response) => {
          // Customer credentials are valid for the storefront, not for Admin.
          // Reject before replacing the current session or navigating to an
          // inaccessible dashboard (which otherwise creates a login/403 loop).
          if (!['ADMIN', 'MANAGER', 'STAFF'].includes(response.user?.systemRole)) {
            throw new AppHttpError(
              403,
              'forbidden',
              'Tài khoản không có quyền truy cập khu vực quản trị.',
            );
          }
          // /auth/login authenticates by username, email or phone. If BE omits
          // username from its serializer, only a verified username login is a
          // trustworthy temporary source (never infer it from name or email).
          const identifier = request.identifier.trim();
          const wasUsernameLogin = !identifier.includes('@') &&
            !/^0[0-9]{9}$/.test(identifier);
          const verifiedUsername = response.user.systemRole === 'ADMIN' && wasUsernameLogin
            ? identifier.toLowerCase()
            : null;
          const user = {
            ...response.user,
            username: response.user.username || verifiedUsername,
          };
          this.authSession.setSession({
            accessToken: response.accessToken,
            roles: [user.systemRole],
            user,
          });
        }),
      );
  }

  logout(): Observable<void> {
    return this.api
      .post<void, Record<string, never>>('/auth/logout', {})
      .pipe(
        finalize(() => {
          this.authSession.clearSession();
        }),
      );
  }
}

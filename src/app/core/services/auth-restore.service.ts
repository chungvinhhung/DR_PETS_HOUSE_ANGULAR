import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, retry, switchMap, tap, throwError, timer, timeout } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AppHttpError } from '../models/app-http-error.model';

import { AuthUser, CurrentUserResponse } from '../models/auth.model';
import { ApiClientService } from './api-client.service';
import { AuthSessionService } from './auth-session.service';
import { AuthTokenRefreshService } from './auth-token-refresh.service';

@Injectable({
  providedIn: 'root',
})
export class AuthRestoreService {
  private readonly api = inject(ApiClientService);
  private readonly authSession = inject(AuthSessionService);
  private readonly tokenRefresh = inject(AuthTokenRefreshService);

  ensureSession(): Observable<boolean> {
    if (this.authSession.isAuthenticated() && this.authSession.user()) {
      return of(true);
    }

    return this.tokenRefresh.refreshAccessToken().pipe(
      switchMap(() => this.api.get<CurrentUserResponse>('/auth/me')),
      map((response) => this.normalizeUser(response)),
      tap((user) => {
        this.authSession.setSession({
          accessToken: this.authSession.accessToken(),
          roles: [user.systemRole],
          user,
        });
      }),
      map(() => true),
      // A temporarily sleeping server must not be confused with an expired account.
      retry({
        count: 1,
        delay: (error: unknown) => this.isTransient(error)
          ? timer(900)
          : throwError(() => error),
      }),
      timeout({ first: 22000 }),
      catchError((error: unknown) => {
        // A failed refresh due to 401/403 is a true unauthenticated state.
        // Never destroy a still-recoverable session on a timeout or 502/503.
        if (!this.isTransient(error)) this.authSession.clearSession();
        return of(false);
      }),
    );
  }

  private isTransient(error: unknown): boolean {
    if (error instanceof AppHttpError || error instanceof HttpErrorResponse) {
      return error.status === 0 || error.status === 502 ||
        error.status === 503 || error.status === 504;
    }
    return error instanceof Error && error.name === 'TimeoutError';
  }

  private normalizeUser(response: CurrentUserResponse): AuthUser {
    return {
      id: response.id ?? response._id ?? '',
      phone: response.phone,
      fullName: response.fullName,
      email: response.email ?? null,
      systemRole: response.systemRole,
      staffSubRole: response.staffSubRole ?? null,
      avatarUrl: response.avatarUrl ?? null,
    };
  }
}

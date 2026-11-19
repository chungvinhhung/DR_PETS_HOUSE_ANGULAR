import { computed, Injectable, signal } from '@angular/core';

import { AuthUser } from '../models/auth.model';

export interface AuthSession {
  accessToken: string | null;
  roles: readonly string[];
  user: AuthUser | null;
}

@Injectable({
  providedIn: 'root',
})
export class AuthSessionService {
  private readonly accessTokenState = signal<string | null>(null);
  private readonly rolesState = signal<readonly string[]>([]);
  private readonly userState = signal<AuthUser | null>(null);
  private readonly usernameCacheKey = 'web2-admin-verified-username';

  readonly accessToken = this.accessTokenState.asReadonly();
  readonly roles = this.rolesState.asReadonly();
  readonly user = this.userState.asReadonly();
  readonly isAuthenticated = computed(() => Boolean(this.accessTokenState()));

  setSession(session: AuthSession): void {
    this.accessTokenState.set(session.accessToken);
    this.rolesState.set([...session.roles]);
    this.userState.set(this.restoreVerifiedUsername(session.user));
  }

  updateAccessToken(accessToken: string): void {
    this.accessTokenState.set(accessToken);
  }

  updateUser(user: AuthUser): void {
    this.userState.set(this.restoreVerifiedUsername(user));
    this.rolesState.set([user.systemRole]);
  }

  clearSession(): void {
    this.accessTokenState.set(null);
    this.rolesState.set([]);
    this.userState.set(null);
    try { sessionStorage.removeItem(this.usernameCacheKey); } catch { /* storage disabled */ }
  }

  /**
   * /auth/me currently omits User.username. Keep the username verified by
   * /auth/login across refreshes in this browser tab, keyed by actual user ID.
   * Only ADMIN accounts use the profile username field. If the server provides
   * a username, it always takes precedence over this temporary cache.
   */
  private restoreVerifiedUsername(user: AuthUser | null): AuthUser | null {
    if (!user || user.systemRole !== 'ADMIN' || !user.id) return user;
    const serverUsername = user.username?.trim();
    if (serverUsername) {
      try {
        sessionStorage.setItem(this.usernameCacheKey,
          JSON.stringify({ userId: user.id, username: serverUsername }));
      } catch { /* storage disabled */ }
      return user;
    }
    try {
      const cached = sessionStorage.getItem(this.usernameCacheKey);
      if (!cached) return user;
      const saved: unknown = JSON.parse(cached);
      if (typeof saved !== 'object' || saved === null) return user;
      const username = (saved as { username?: unknown }).username;
      const userId = (saved as { userId?: unknown }).userId;
      if (userId === user.id && typeof username === 'string' && username.trim()) {
        return { ...user, username };
      }
    } catch { /* invalid or inaccessible browser storage */ }
    return user;
  }

  hasAnyRole(requiredRoles: readonly string[]): boolean {
    if (requiredRoles.length === 0) {
      return true;
    }

    const currentRoles = new Set(this.rolesState());
    return requiredRoles.some((role) => currentRoles.has(role));
  }
}

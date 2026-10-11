import { computed, Injectable, signal } from '@angular/core';

export interface AuthSession {
  accessToken: string | null;
  roles: readonly string[];
}

@Injectable({
  providedIn: 'root',
})
export class AuthSessionService {
  private readonly accessTokenState = signal<string | null>(null);
  private readonly rolesState = signal<readonly string[]>([]);

  readonly accessToken = this.accessTokenState.asReadonly();
  readonly roles = this.rolesState.asReadonly();
  readonly isAuthenticated = computed(() => Boolean(this.accessTokenState()));

  setSession(session: AuthSession): void {
    this.accessTokenState.set(session.accessToken);
    this.rolesState.set([...session.roles]);
  }

  clearSession(): void {
    this.accessTokenState.set(null);
    this.rolesState.set([]);
  }

  hasAnyRole(requiredRoles: readonly string[]): boolean {
    if (requiredRoles.length === 0) {
      return true;
    }

    const currentRoles = new Set(this.rolesState());
    return requiredRoles.some((role) => currentRoles.has(role));
  }
}

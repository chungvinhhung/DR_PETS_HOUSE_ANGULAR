import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';

import { AuthSessionService } from '../../services/auth-session.service';
import { TEST_AUTHENTICATED } from '../constants/dev-flags';
import { DEFAULT_USER_PROFILE, PROFILE_STORAGE_KEYS } from '../constants/user-profile-data';

const AUTH_STORAGE_KEY = 'drPetAuthSession';
const LEGACY_AUTH_STORAGE_KEY = 'isAuthenticated';
const ACCESS_TOKEN_KEY = 'accessToken';
const REMEMBER_LOGIN_DAYS = 30;
const REMEMBER_LOGIN_MS = REMEMBER_LOGIN_DAYS * 24 * 60 * 60 * 1000;

/** Các màn hình của popup đăng nhập (AuthModal). */
export type AuthModalScreen = 'login' | 'register' | 'forgot' | 'resetOtp' | 'registerOtp' | 'reset' | 'success' | string;

interface StoredAuthSession {
  authenticated: boolean;
  createdAt: number;
  expiresAt: number | null;
  remember: boolean;
}

export interface CompleteLoginOptions {
  remember?: boolean;
  accessToken?: string | null;
  /** user trả về từ back-end (dạng snake_case của WEB2_BACKEND) */
  user?: Record<string, any> | null;
}

function getStoredAuthSession(): StoredAuthSession | null {
  for (const storage of [localStorage, sessionStorage]) {
    const storedValue = storage.getItem(AUTH_STORAGE_KEY);
    if (!storedValue) continue;
    try {
      const session = JSON.parse(storedValue) as StoredAuthSession;
      if (session?.authenticated && (!session.expiresAt || session.expiresAt > Date.now())) return session;
    } catch {
      // dữ liệu hỏng -> xóa bên dưới
    }
    storage.removeItem(AUTH_STORAGE_KEY);
  }
  return null;
}

function clearStoredAuthentication(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}

function loadUserProfile(): Record<string, any> {
  try {
    const storedProfile = localStorage.getItem(PROFILE_STORAGE_KEYS.profile);
    return storedProfile ? JSON.parse(storedProfile) : { ...DEFAULT_USER_PROFILE };
  } catch {
    return { ...DEFAULT_USER_PROFILE };
  }
}

/**
 * Trạng thái đăng nhập của KHÁCH HÀNG (thay cho context/AuthContext.jsx của React).
 *
 * - isAuthenticated / authModal / userProfile là signal -> template tự cập nhật.
 * - openAuth('login' | 'register' ...) mở popup đăng nhập (AuthModalComponent nằm trong CustomerLayout).
 * - requireAuth(callback): nếu chưa đăng nhập thì mở popup, đăng nhập xong mới chạy callback.
 * - Access token được đưa vào AuthSessionService của core -> authInterceptor tự gắn header Bearer.
 * - Phiên đăng nhập lưu ở localStorage (khi chọn "Ghi nhớ") hoặc sessionStorage, giống bản React.
 */
@Injectable({ providedIn: 'root' })
export class CustomerAuthService {
  private readonly coreSession = inject(AuthSessionService);

  private readonly authenticated = signal<boolean>(this.loadAuthentication(TEST_AUTHENTICATED));
  private readonly authExpiresAt = signal<number | null>(this.safe(() => getStoredAuthSession()?.expiresAt ?? null, null));
  private pendingAuthAction: (() => void) | null = null;
  private expiryTimer: number | undefined;

  readonly isAuthenticated = computed(() => this.authenticated());
  readonly authModal = signal<AuthModalScreen | null>(null);
  readonly userProfile = signal<any>(loadUserProfile());

  constructor() {
    // Khôi phục token đã lưu để interceptor gắn Authorization cho các request sau khi F5.
    const token = this.safe(() => localStorage.getItem(ACCESS_TOKEN_KEY) || sessionStorage.getItem(ACCESS_TOKEN_KEY), null);
    if (this.authenticated() && token && !this.coreSession.accessToken()) {
      this.coreSession.setSession({ accessToken: token, roles: ['CUSTOMER'], user: null });
    }

    const handleAuthExpired = () => {
      this.pendingAuthAction = null;
      this.authExpiresAt.set(null);
      this.authenticated.set(false);
      this.authModal.set('login');
    };
    window.addEventListener('petclinic:auth-expired', handleAuthExpired);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('petclinic:auth-expired', handleAuthExpired));

    this.scheduleExpiryCheck();
  }

  readonly openAuth = (screen: AuthModalScreen = 'login'): void => {
    this.authModal.set(screen);
  }

  readonly closeAuth = (): void => {
    this.pendingAuthAction = null;
    this.authModal.set(null);
  }

  /** Chạy onAuthenticated nếu đã đăng nhập; nếu chưa thì mở popup và chờ đăng nhập xong. */
  readonly requireAuth = (onAuthenticated?: () => void): boolean => {
    if (this.authenticated()) {
      onAuthenticated?.();
      return true;
    }
    this.pendingAuthAction = onAuthenticated ?? null;
    this.authModal.set('login');
    return false;
  }

  readonly updateUserProfile = (updates: Record<string, any>): void => {
    this.userProfile.update((current) => {
      const nextProfile = { ...current, ...updates };
      localStorage.setItem(PROFILE_STORAGE_KEYS.profile, JSON.stringify(nextProfile));
      return nextProfile;
    });
  }

  readonly completeLogin = (profileUpdates: Record<string, any> = {}, options: CompleteLoginOptions = {}): void => {
    const backendUser = options.user || {};
    const nextProfile = {
      ...profileUpdates,
      ...(backendUser['full_name'] ? { fullName: backendUser['full_name'] } : {}),
      ...(backendUser['email'] ? { email: backendUser['email'] } : {}),
      ...(backendUser['phone'] ? { phone: backendUser['phone'] } : {}),
      ...(backendUser['user_id'] ? { userId: backendUser['user_id'] } : {}),
      ...(backendUser['role_code'] ? { roleCode: backendUser['role_code'] } : {}),
    };
    if (Object.keys(nextProfile).length > 0) this.updateUserProfile(nextProfile);

    const remember = Boolean(options.remember);
    const authSession: StoredAuthSession = {
      authenticated: true,
      createdAt: Date.now(),
      expiresAt: remember ? Date.now() + REMEMBER_LOGIN_MS : null,
      remember,
    };

    clearStoredAuthentication();
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authSession));
    if (options.accessToken) {
      storage.setItem(ACCESS_TOKEN_KEY, options.accessToken);
      this.coreSession.setSession({ accessToken: options.accessToken, roles: ['CUSTOMER'], user: null });
    }

    this.authExpiresAt.set(authSession.expiresAt);
    this.authenticated.set(true);
    this.authModal.set(null);
    this.scheduleExpiryCheck();
    const pendingAction = this.pendingAuthAction;
    this.pendingAuthAction = null;
    pendingAction?.();
  }

  readonly logout = (): void => {
    this.pendingAuthAction = null;
    clearStoredAuthentication();
    this.coreSession.clearSession();
    this.authExpiresAt.set(null);
    this.authenticated.set(false);
    this.authModal.set(null);
    window.clearTimeout(this.expiryTimer);
  }

  /** Tự đăng xuất khi hết hạn "Ghi nhớ đăng nhập" (30 ngày). */
  private scheduleExpiryCheck(): void {
    window.clearTimeout(this.expiryTimer);
    const expiresAt = this.authExpiresAt();
    if (!this.authenticated() || !expiresAt) return;
    const delay = expiresAt - Date.now();
    if (delay <= 0) {
      this.logout();
      return;
    }
    this.expiryTimer = window.setTimeout(() => this.scheduleExpiryCheck(), Math.min(delay, 2_147_483_647));
  }

  private loadAuthentication(defaultValue: boolean): boolean {
    try {
      localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
      return Boolean(getStoredAuthSession()) || defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private safe<T>(fn: () => T, fallback: T): T {
    try {
      return fn();
    } catch {
      return fallback;
    }
  }
}

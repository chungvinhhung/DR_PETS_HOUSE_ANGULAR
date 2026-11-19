import { ChangeDetectionStrategy, Component, afterNextRender, inject, signal } from '@angular/core';
import { CustomerAuthService } from '../../../../core/customer/services/customer-auth.service';
import { AuthApiService } from '../../../../core/customer/services/api/auth-api.service';
import { environment } from '../../../../../environments/environment';

/**
 * Actual Google OAuth access-token flow. Never use the BE's simulated account
 * selector: it is not proof that someone owns a Google account.
 */
@Component({
  selector: 'button[app-google-button]',
  standalone: true,
  templateUrl: './google-button.component.html',
  styleUrl: './google-button.component.scss',
  host: {
    'type': 'button',
    'class': 'focus-ring-brand flex h-[39px] w-full items-center justify-center gap-2 rounded-md border border-black bg-white text-sm font-medium',
    '[disabled]': 'isLoading()',
    '(click)': 'handleGoogleLogin($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoogleButtonComponent {
  private readonly customerAuth = inject(CustomerAuthService);
  private readonly authApi = inject(AuthApiService);
  private googleScriptPromise?: Promise<void>;
  readonly isLoading = signal(false);

  constructor() {
    afterNextRender(() => {
      if (environment.googleOAuthClientId) {
        void this.loadGoogleIdentity().catch(() => {
          // A visible error is shown on click if Google fails to load.
        });
      }
    });
  }

  private loadGoogleIdentity(): Promise<void> {
    if ((window as any).google?.accounts?.oauth2) return Promise.resolve();
    if (!this.googleScriptPromise) {
      this.googleScriptPromise = new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => {
          this.googleScriptPromise = undefined;
          reject(new Error('Không thể tải dịch vụ đăng nhập Google. Vui lòng thử lại.'));
        };
        document.head.appendChild(script);
      });
    }
    return this.googleScriptPromise;
  }

  async handleGoogleLogin(event: Event) {
    event.preventDefault();
    if (this.isLoading()) return;

    const clientId = environment.googleOAuthClientId?.trim();
    if (!clientId) {
      window.alert('Đăng nhập Google chưa được cấu hình OAuth chính thức. Vui lòng liên hệ quản trị viên.');
      return;
    }

    this.isLoading.set(true);
    try {
      await this.loadGoogleIdentity();
      const google = (window as any).google;
      if (!google?.accounts?.oauth2?.initTokenClient) {
        throw new Error('Không thể khởi tạo đăng nhập Google.');
      }

      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'openid email profile',
        callback: async (response: any) => {
          try {
            if (response?.error || !response?.access_token) {
              throw new Error('Google không trả về thông tin xác thực hợp lệ.');
            }
            const data = await this.authApi.loginWithGoogle({ accessToken: response.access_token });
            if (!data.accessToken || !data.user) {
              throw new Error('Máy chủ chưa hoàn tất xác thực Google.');
            }
            this.customerAuth.completeLogin({
              fullName: data.user.fullName || data.user.full_name || 'Người dùng Google',
              email: data.user.email || '',
              phone: data.user.phone || '',
            }, {
              accessToken: data.accessToken,
              user: data.user,
              remember: true,
            });
          } catch (error: any) {
            window.alert(error?.message || 'Đăng nhập Google thất bại. Vui lòng thử lại.');
          } finally {
            this.isLoading.set(false);
          }
        },
        error_callback: () => {
          this.isLoading.set(false);
          window.alert('Cửa sổ đăng nhập Google bị đóng hoặc không thể mở.');
        },
      });
      client.requestAccessToken({ prompt: 'select_account' });
    } catch (error: any) {
      this.isLoading.set(false);
      window.alert(error?.message || 'Không thể khởi tạo đăng nhập Google.');
    }
  }
}

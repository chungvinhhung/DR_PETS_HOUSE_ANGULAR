import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CustomerAuthService } from '../../../../core/customer/services/customer-auth.service';
import { AuthApiService } from '../../../../core/customer/services/api/auth-api.service';
import { environment } from '../../../../../environments/environment';

/**
 * GoogleButton — chuyển từ React: src/components/auth/AuthModal.jsx
 */
@Component({
  selector: 'button[app-google-button]',
  standalone: true,
  imports: [],
  templateUrl: './google-button.component.html',
  styleUrl: './google-button.component.scss',
  host: {
    'type': 'button',
    'class': 'focus-ring-brand flex h-[39px] w-full items-center justify-center gap-2 rounded-md border border-black bg-white text-sm font-medium',
    '(click)': 'handleGoogleLogin($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoogleButtonComponent {
  private readonly customerAuth = inject(CustomerAuthService);
  private readonly authApi = inject(AuthApiService);
  readonly isLoading = signal(false);

  async handleGoogleLogin(event: Event) {
    event.preventDefault();
    if (this.isLoading()) return;
    this.isLoading.set(true);

    try {
      const width = 520;
      const height = 660;
      const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
      const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);

      const apiOrigin = new URL(environment.apiBaseUrl).origin;
      const authUrl = new URL(environment.apiBaseUrl.replace(/[/]+$/, '') + '/auth/google');
      authUrl.searchParams.set('returnUrl', window.location.pathname + window.location.search);
      const popup = window.open(
        authUrl.toString(),
        'GoogleOAuthPopup',
        `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no,location=no,resizable=yes`,
      );

      if (!popup) {
        // Redirect directly to Google Account Chooser like Facebook / Instagram standard OAuth flow
        window.location.href = authUrl.toString();
        return;
      }

      await new Promise<void>((resolve, reject) => {
        let cleanupDone = false;

        const onMessage = (msgEvent: MessageEvent) => {
          if (msgEvent.origin !== apiOrigin || msgEvent.source !== popup) return;
          if (msgEvent.data?.type === 'GOOGLE_AUTH_SUCCESS' && typeof msgEvent.data.token === 'string' && msgEvent.data.token) {
            cleanup();
            const { token, user } = msgEvent.data;
            this.customerAuth.completeLogin({
              fullName: user?.full_name || user?.fullName || 'Người dùng Google',
              email: user?.email || '',
              phone: user?.phone || '',
            }, {
              accessToken: token,
              user,
              remember: true,
            });
            resolve();
          }
        };

        const timer = setInterval(() => {
          if (popup.closed) {
            cleanup();
            resolve();
          }
        }, 600);

        const cleanup = () => {
          if (cleanupDone) return;
          cleanupDone = true;
          window.removeEventListener('message', onMessage);
          clearInterval(timer);
        };

        window.addEventListener('message', onMessage);
      });
    } catch (err: any) {
      alert(err?.message || 'Đăng nhập Google thất bại. Vui lòng thử lại.');
    } finally {
      this.isLoading.set(false);
    }
  }
}

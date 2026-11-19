/**
 * Chuyển từ React: src/services/authService.js
 *
 * - Các hàm "normalize..." / tiện ích không gọi API: giữ nguyên là hàm export (thuần, dùng được ở mọi nơi).
 * - Các hàm async gọi API: gom vào class AuthApiService (inject vào component).
 *   Gọi HTTP qua CustomerHttpService (bọc ApiClientService của core) -> trả về Promise như axios cũ.
 */
import { Injectable, inject } from '@angular/core';

import { CustomerHttpService, assertSuccess } from '../customer-http.service';
import { environment } from '../../../../../environments/environment';

function canUseFrontendAuthFallback(error: any) {
  return !environment.production && (error?.status === null || error?.status === undefined);
}

function buildFrontendAuthSession({ loginId, fullName, phone, email }: any = {}) {
  const account = loginId || email || phone || "customer@example.com";
  const accountIsEmail = String(account).includes("@");

  return {
    access_token: `frontend-dev-token-${Date.now()}`,
    frontendFallback: true,
    user: {
      user_id: "frontend-dev-user",
      full_name: fullName || "Khách hàng Dr. Pet",
      email: email || (accountIsEmail ? account : "customer@example.com"),
      phone: phone || (accountIsEmail ? "0901234567" : account),
      role_code: "CUSTOMER",
      fullName: fullName || "Khách hàng Dr. Pet",
      userId: "frontend-dev-user",
    },
  };
}

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(CustomerHttpService);

  async login({ loginId, password, remember = false }: any) {
    try {
      try {
        const response: any = await this.http.post("/auth/login", {
          identifier: loginId,
          password
        });
        const payload: any = assertSuccess(response);
        const user = payload?.user || payload;
        const token = payload?.accessToken || payload?.access_token || payload?.token;
        return {
          accessToken: token,
          access_token: token,
          token,
          user: user
            ? {
                user_id: user.id || user.user_id,
                full_name: user.fullName || user.full_name,
                email: user.email || '',
                phone: user.phone || '',
                role_code: user.systemRole || user.role_code || 'CUSTOMER',
                customerId: user.customerId || user.id,
                fullName: user.fullName || user.full_name,
                userId: user.id || user.user_id,
              }
            : null,
        };
      } catch (error: any) {
        if (error?.status !== 404) throw error;
      }

      // Fallback API cũ
      const response = await this.http.post("/login", {
        login_id: loginId,
        password,
        remember_me: remember,
      });
      return assertSuccess(response);
    } catch (error: any) {
      if (canUseFrontendAuthFallback(error)) {
        return buildFrontendAuthSession({ loginId });
      }
      throw error;
    }
  }

  async register({ fullName, phone, email, password, confirmPassword }: any) {
    try {
      const cleanPhone = String(phone || '').replace(/\s+/g, '');
      const payload: any = {
        fullName: String(fullName || '').trim(),
        phone: cleanPhone || undefined,
        email: email ? String(email).trim().toLowerCase() : undefined,
        password: password,
        confirmPassword: confirmPassword || password,
        acceptTerms: true,
      };
      const response = await this.http.post("/auth/register", payload);
      return assertSuccess(response);
    } catch (error: any) {
      if (canUseFrontendAuthFallback(error)) {
        return buildFrontendAuthSession({ fullName, phone, email });
      }
      throw error;
    }
  }

  async refreshToken() {
    const response = await this.http.post("/auth/refresh-token");
    return assertSuccess(response);
  }

  async loginWithGoogle(data: any = {}) {
    const credential = data.credential || data.idToken || data.token || 'google_mock_credential';
    const payload = {
      ...data,
      credential,
      email: data.email || 'google_user@test.com',
      fullName: data.fullName || data.name || 'Người dùng Google',
      picture: data.picture || data.avatar || null,
    };
    const response: any = await this.http.post("/auth/google", payload);
    const result = assertSuccess(response);
    const user = result?.user || result;
    const token = result?.accessToken || result?.access_token || result?.token;
    return {
      accessToken: token,
      access_token: token,
      token,
      user: user
        ? {
            user_id: user.id || user.user_id,
            full_name: user.fullName || user.full_name,
            email: user.email || '',
            phone: user.phone || '',
            role_code: user.systemRole || user.role_code || 'CUSTOMER',
            customerId: user.customerId || user.id,
            fullName: user.fullName || user.full_name,
            userId: user.id || user.user_id,
          }
        : null,
    };
  }

  async requestGuestOtp(phone: string) {
    try {
      const response = await this.http.post("/guest/lookup/otp", { phone });
      return assertSuccess(response);
    } catch {
      const response = await this.http.post("/auth/guest-otp", { phone });
      return assertSuccess(response);
    }
  }

  async activateGuestAccount(token: string, password: string) {
    try {
      const response = await this.http.post("/activation/complete", { token, password });
      return assertSuccess(response);
    } catch {
      const response = await this.http.post("/auth/activate-guest", { token, password });
      return assertSuccess(response);
    }
  }

  async verifyRegisterOtp({ loginId, otpCode }: any) {
    const cleanId = String(loginId || '').trim();
    const response = await this.http.post("/verify-register-otp", {
      identifier: cleanId,
      login_id: cleanId,
      loginId: cleanId,
      otp_code: otpCode,
      otpCode: otpCode,
      purpose: 'REGISTER',
    });
    return assertSuccess(response);
  }

  async forgotPassword(account: any) {
    const cleanAccount = String(account || '').trim();
    const response = await this.http.post("/auth/forgot-password", {
      identifier: cleanAccount,
      email: cleanAccount.includes('@') ? cleanAccount : undefined,
      phone: !cleanAccount.includes('@') ? cleanAccount : undefined,
    });
    return assertSuccess(response);
  }

  async resendOtp(account: any, purpose: string = 'FORGOT_PASSWORD') {
    const cleanAccount = String(account || '').trim();
    const response = await this.http.post("/auth/resend-otp", {
      identifier: cleanAccount,
      purpose,
    });
    return assertSuccess(response);
  }

  async verifyForgotOtp({ email, account, otpCode }: any) {
    const target = String(account || email || '').trim();
    const response = await this.http.post("/auth/verify-otp", {
      identifier: target,
      email: target.includes('@') ? target : undefined,
      phone: !target.includes('@') ? target : undefined,
      otpCode,
      otp_code: otpCode,
      purpose: 'FORGOT_PASSWORD',
    });
    return assertSuccess(response);
  }

  async resetPassword({ resetToken, newPassword }: any) {
    const response = await this.http.post("/auth/reset-password", {
      resetToken,
      reset_token: resetToken,
      newPassword,
      new_password: newPassword,
      confirmPassword: newPassword,
    });
    return assertSuccess(response);
  }

  async changePassword({ oldPassword, newPassword }: any) {
    const response = await this.http.post("/change-password", {
      old_password: oldPassword,
      new_password: newPassword,
    });
    return assertSuccess(response);
  }

  async logout() {
    try {
      const response = await this.http.post("/auth/logout");
      return assertSuccess(response);
    } catch {
      return { success: true };
    }
  }
}

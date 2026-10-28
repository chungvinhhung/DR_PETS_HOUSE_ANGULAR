/**
 * Chuyển từ React: src/services/authService.js
 *
 * - Các hàm "normalize..." / tiện ích không gọi API: giữ nguyên là hàm export (thuần, dùng được ở mọi nơi).
 * - Các hàm async gọi API: gom vào class AuthApiService (inject vào component).
 *   Gọi HTTP qua CustomerHttpService (bọc ApiClientService của core) -> trả về Promise như axios cũ.
 */
import { Injectable, inject } from '@angular/core';

import { CustomerHttpService } from '../customer-http.service';
import { environment } from '../../../../../environments/environment';

function assertSuccess(response: any) {
  if (response?.EC !== undefined && response.EC !== 0) {
    throw new Error(response.EM || "Yeu cau khong thanh cong");
  }
  return response?.DT ?? response;
}

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
      full_name: fullName || "Khach hang Dr. Pet",
      email: email || (accountIsEmail ? account : "customer@example.com"),
      phone: phone || (accountIsEmail ? "0901234567" : account),
      role_code: "CUSTOMER",
    },
  };
}

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(CustomerHttpService);

  async login({ loginId, password, remember = false }: any) {
    try {
      try {
        // Hợp đồng API chung của dự án (xem docs/TASK-3.5-PHASE-2-LOGIN-API.md): { identifier, password } -> { accessToken, user }
        const response: any = await this.http.post("/auth/login", { identifier: loginId, password });
        return {
          access_token: response?.accessToken,
          user: response?.user
            ? {
                user_id: response.user.id,
                full_name: response.user.fullName,
                email: response.user.email,
                phone: response.user.phone,
                role_code: response.user.systemRole,
              }
            : null,
        };
      } catch (error: any) {
        if (error?.status !== 404) throw error;
      }
      // API cũ (WEB2_BACKEND) mà bản React đang dùng
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

  async register({ fullName, phone, email, password }: any) {
    try {
      const response = await this.http.post("/register", {
        full_name: fullName,
        phone: phone || undefined,
        email: email || undefined,
        password,
      });
      return assertSuccess(response);
    } catch (error: any) {
      if (canUseFrontendAuthFallback(error)) {
        return buildFrontendAuthSession({ fullName, phone, email });
      }
      throw error;
    }
  }

  async verifyRegisterOtp({ loginId, otpCode }: any) {
    const response = await this.http.post("/verify-register-otp", {
      login_id: loginId,
      otp_code: otpCode,
    });
    return assertSuccess(response);
  }

  async forgotPassword(email: any) {
    const response = await this.http.post("/forgot-password", { email });
    return assertSuccess(response);
  }

  async verifyForgotOtp({ email, otpCode }: any) {
    const response = await this.http.post("/verify-otp", {
      email,
      otp_code: otpCode,
    });
    return assertSuccess(response);
  }

  async resetPassword({ resetToken, newPassword }: any) {
    const response = await this.http.post("/reset-password", {
      reset_token: resetToken,
      new_password: newPassword,
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
    const response = await this.http.post("/logout");
    return assertSuccess(response);
  }
}

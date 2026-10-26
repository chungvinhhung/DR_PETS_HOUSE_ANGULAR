import { HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';

import { AppHttpError } from '../../models/app-http-error.model';
import { ApiClientService } from '../../services/api-client.service';

/**
 * Lỗi HTTP theo đúng "hình dạng" mà code React cũ (axios interceptor trong apiClient.js) trả về,
 * để các chỗ đang dùng `error.status`, `error.message`, `error.data` vẫn chạy như cũ.
 */
export interface CustomerHttpError {
  status: number | null;
  message: string;
  data: unknown;
  authExpired: boolean;
}

export interface CustomerRequestOptions {
  /** Giống axios: object thường, các giá trị undefined/null/'' sẽ bị bỏ qua. */
  params?: Record<string, unknown>;
  headers?: Record<string, string>;
}

/**
 * Thay thế `services/apiClient.js` (axios) của bản React.
 *
 * Luồng gọi API (đúng quy ước repo): Component -> *ApiService -> CustomerHttpService -> ApiClientService -> HttpClient.
 *  - Base URL lấy từ `environment.apiBaseUrl` (ApiClientService lo việc ghép URL).
 *  - Header Authorization / refresh token do interceptor của core xử lý.
 *  - Trả về Promise (thay vì Observable) để code async/await chuyển từ React giữ nguyên logic.
 */
@Injectable({ providedIn: 'root' })
export class CustomerHttpService {
  private readonly api = inject(ApiClientService);

  get<T = any>(path: string, options: CustomerRequestOptions = {}): Promise<T> {
    return this.run(this.api.get<T>(path, this.toOptions(options)));
  }

  post<T = any>(path: string, body: unknown = {}, options: CustomerRequestOptions = {}): Promise<T> {
    return this.run(this.api.post<T>(path, body, this.toOptions(options)));
  }

  put<T = any>(path: string, body: unknown = {}, options: CustomerRequestOptions = {}): Promise<T> {
    return this.run(this.api.put<T>(path, body, this.toOptions(options)));
  }

  patch<T = any>(path: string, body: unknown = {}, options: CustomerRequestOptions = {}): Promise<T> {
    return this.run(this.api.patch<T>(path, body, this.toOptions(options)));
  }

  delete<T = any>(path: string, options: CustomerRequestOptions = {}): Promise<T> {
    return this.run(this.api.delete<T>(path, this.toOptions(options)));
  }

  private toOptions(options: CustomerRequestOptions) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(options.params ?? {})) {
      if (value === undefined || value === null || value === '') continue;
      params = params.set(key, String(value));
    }
    return {
      params,
      headers: new HttpHeaders({ 'ngrok-skip-browser-warning': '69420', ...(options.headers ?? {}) }),
    };
  }

  private async run<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw this.toCustomerError(error);
    }
  }

  private toCustomerError(error: unknown): CustomerHttpError {
    if (error instanceof AppHttpError) {
      const data = error.details as { EC?: number; EM?: string; message?: string; error?: string } | null;
      const authExpired = error.status === 401 || data?.EC === -999;
      if (authExpired) {
        // CustomerAuthService lắng nghe sự kiện này để đăng xuất + mở form đăng nhập (giống bản React).
        window.dispatchEvent(new CustomEvent('petclinic:auth-expired'));
      }
      return {
        status: error.status || null,
        message: authExpired
          ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
          : data?.EM || data?.message || data?.error || error.message || 'API request failed',
        data,
        authExpired,
      };
    }
    const message = error instanceof Error ? error.message : 'API request failed';
    return { status: null, message, data: null, authExpired: false };
  }
}

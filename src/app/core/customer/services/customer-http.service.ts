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
  skipIdempotency?: boolean;
}

/**
 * Normalizer Response Đa Hình:
 * Tự động thích ứng cả Backend MongoDB mới { success, data }, Direct REST, lẫn Legacy Web 1 { EC, EM, DT }
 */
export function assertSuccess<T = any>(response: any): T {
  if (response === null || response === undefined) {
    return null as unknown as T;
  }

  // 1. Chuẩn REST OpenAPI V7 Backend MongoDB: { success: true, data: ... }
  if (response && typeof response === 'object' && 'success' in response) {
    if (!response.success) {
      throw new Error(response.message || 'Yêu cầu không thành công');
    }
    return (response.data !== undefined ? response.data : response) as T;
  }

  // 2. Chuẩn Legacy Web 1: { EC: 0, EM: '...', DT: ... }
  if (response && typeof response === 'object' && 'EC' in response) {
    if (response.EC !== 0) {
      throw new Error(response.EM || 'Yêu cầu không thành công');
    }
    return (response.DT !== undefined ? response.DT : response) as T;
  }

  // 3. Chuẩn Direct REST: Trả về trực tiếp response hoặc response.data
  return (response.data !== undefined ? response.data : response) as T;
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
    return this.run(this.api.get<T>(path, this.toOptions('GET', options)));
  }

  post<T = any>(path: string, body: unknown = {}, options: CustomerRequestOptions = {}): Promise<T> {
    return this.run(this.api.post<T>(path, body, this.toOptions('POST', options)));
  }

  put<T = any>(path: string, body: unknown = {}, options: CustomerRequestOptions = {}): Promise<T> {
    return this.run(this.api.put<T>(path, body, this.toOptions('PUT', options)));
  }

  patch<T = any>(path: string, body: unknown = {}, options: CustomerRequestOptions = {}): Promise<T> {
    return this.run(this.api.patch<T>(path, body, this.toOptions('PATCH', options)));
  }

  delete<T = any>(path: string, options: CustomerRequestOptions = {}): Promise<T> {
    return this.run(this.api.delete<T>(path, this.toOptions('DELETE', options)));
  }

  private generateIdempotencyKey(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private toOptions(method: string, options: CustomerRequestOptions) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(options.params ?? {})) {
      if (value === undefined || value === null || value === '') continue;
      params = params.set(key, String(value));
    }

    let headers = new HttpHeaders({
      'ngrok-skip-browser-warning': '69420',
      ...(options.headers ?? {}),
    });

    // Tự động sinh Idempotency-Key cho các request làm thay đổi dữ liệu
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase()) && !options.skipIdempotency) {
      if (!headers.has('Idempotency-Key') && !headers.has('idempotency-key')) {
        headers = headers.set('Idempotency-Key', this.generateIdempotencyKey());
      }
    }

    return {
      params,
      headers,
      withCredentials: true,
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
      const data = error.details as any;
      const authExpired = error.status === 401 || data?.EC === -999;
      if (authExpired) {
        // CustomerAuthService lắng nghe sự kiện này để đăng xuất + mở form đăng nhập (giống bản React).
        window.dispatchEvent(new CustomEvent('petclinic:auth-expired'));
      }
      return {
        status: error.status || null,
        message:
          data?.message ||
          data?.detail ||
          data?.EM ||
          data?.error ||
          (authExpired ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' : 'Thao tác không thành công'),
        data,
        authExpired,
      };
    }
    const message = error instanceof Error ? error.message : 'API request failed';
    return { status: null, message, data: null, authExpired: false };
  }
}

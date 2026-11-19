import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';

import {
  AppHttpError,
  AppHttpErrorKind,
  backendProblemMessage,
} from '../models/app-http-error.model';

@Injectable({
  providedIn: 'root',
})
export class HttpErrorService {
  private readonly lastErrorState = signal<AppHttpError | null>(null);

  readonly lastError = this.lastErrorState.asReadonly();

  map(error: HttpErrorResponse): AppHttpError {
    const mapped = new AppHttpError(
      error.status,
      this.kindForStatus(error.status),
      this.messageForError(error),
      error.error,
    );

    this.lastErrorState.set(mapped);
    return mapped;
  }

  clear(): void {
    this.lastErrorState.set(null);
  }

  private kindForStatus(status: number): AppHttpErrorKind {
    if (status === 0) return 'network';
    if (status === 400) return 'bad-request';
    if (status === 401) return 'unauthorized';
    if (status === 403) return 'forbidden';
    if (status === 404) return 'not-found';
    if (status === 409) return 'conflict';
    if (status === 422) return 'validation';
    if (status === 423) return 'locked';
    if (status >= 500) return 'server';

    return 'unknown';
  }

  private messageForError(error: HttpErrorResponse): string {
    // Precise BE problem codes take precedence over generic HTTP 403/409.
    const problemMessage = backendProblemMessage(error.error);
    if (problemMessage) return problemMessage;

    const backendMessage = this.extractBackendMessage(error.error);

    if (backendMessage) {
      return backendMessage;
    }

    switch (error.status) {
      case 0:
        return 'Không thể kết nối đến máy chủ.';
      case 400:
        return 'Yêu cầu không hợp lệ.';
      case 401:
        return 'Vui lòng đăng nhập để tiếp tục.';
      case 403:
        return 'Bạn không có quyền thực hiện thao tác này.';
      case 404:
        return 'Không tìm thấy dữ liệu yêu cầu.';
      case 409:
        return 'Dữ liệu đã thay đổi hoặc đang bị xung đột. Vui lòng tải lại.';
      case 422:
        return 'Dữ liệu gửi lên chưa hợp lệ.';
      case 423:
        return 'Tài khoản đang tạm khóa. Vui lòng thử lại sau.';
      default:
        return error.status >= 500
          ? 'Máy chủ đang gặp sự cố. Vui lòng thử lại.'
          : 'Đã xảy ra lỗi. Vui lòng thử lại.';
    }
  }

  private extractBackendMessage(body: unknown): string | null {
    if (typeof body !== 'object' || body === null) {
      return null;
    }

    if (
      'detail' in body &&
      typeof (body as { detail?: unknown }).detail === 'string'
    ) {
      return (body as { detail: string }).detail;
    }

    if (
      'message' in body &&
      typeof (body as { message?: unknown }).message === 'string'
    ) {
      return (body as { message: string }).message;
    }

    return null;
  }
}

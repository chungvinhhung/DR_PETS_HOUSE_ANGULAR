import { Injectable, computed, signal } from '@angular/core';

/**
 * Giữ lookup token của Guest sau khi xác minh OTP.
 *
 * - Chỉ lưu trong bộ nhớ (signal), KHÔNG ghi localStorage/sessionStorage: tải lại trang = xác minh lại OTP.
 * - Thời hạn lấy từ `expiresIn` BE trả về; hết hạn thì token bị xóa và trang yêu cầu xác minh lại.
 * - Không log token ra console.
 */
@Injectable({ providedIn: 'root' })
export class GuestLookupSessionService {
  private readonly tokenState = signal<string | null>(null);
  private readonly expiresAtState = signal<number | null>(null);
  private readonly maskedContactState = signal('');

  readonly maskedContact = this.maskedContactState.asReadonly();
  readonly expiresAt = this.expiresAtState.asReadonly();
  readonly hasSession = computed(() => Boolean(this.tokenState()));

  start(lookupToken: string, expiresInSeconds: number, maskedContact: string): void {
    this.tokenState.set(lookupToken);
    this.expiresAtState.set(Date.now() + expiresInSeconds * 1000);
    this.maskedContactState.set(maskedContact);
  }

  /** Token còn hạn, hoặc null (và tự xóa) nếu đã hết hạn. */
  token(): string | null {
    const expiresAt = this.expiresAtState();
    if (!this.tokenState() || (expiresAt !== null && Date.now() >= expiresAt)) {
      this.clear();
      return null;
    }
    return this.tokenState();
  }

  clear(): void {
    this.tokenState.set(null);
    this.expiresAtState.set(null);
    this.maskedContactState.set('');
  }
}

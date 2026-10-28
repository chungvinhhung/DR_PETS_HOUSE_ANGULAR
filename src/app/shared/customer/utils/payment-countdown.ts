import { effect, signal, Signal } from '@angular/core';

/**
 * Đếm ngược thời gian thanh toán (thay cho custom hook usePaymentCountdown của React).
 *
 * Dùng trong component (gọi ở field initializer / constructor):
 *   readonly remainingSeconds = createPaymentCountdown(() => this.appointment().paymentExpiresAt);
 *
 * Trả về signal số giây còn lại, tự cập nhật mỗi giây và tự dừng khi component bị hủy.
 */
export function createPaymentCountdown(expiresAt: () => string | number | Date | null | undefined): Signal<number> {
  const getRemainingSeconds = (value: string | number | Date | null | undefined) =>
    value ? Math.max(0, Math.floor((new Date(value).getTime() - Date.now()) / 1000)) : 0;

  const remaining = signal(0);
  effect((onCleanup) => {
    const value = expiresAt();
    remaining.set(getRemainingSeconds(value));
    if (!value) return;
    const intervalId = window.setInterval(() => remaining.set(getRemainingSeconds(value)), 1000);
    onCleanup(() => window.clearInterval(intervalId));
  });
  return remaining.asReadonly();
}

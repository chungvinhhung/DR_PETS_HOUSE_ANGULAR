/**
 * Chuyển lỗi HTTP (CustomerHttpError, body RFC 9457 { status, code, detail }) thành thông báo cho Guest.
 *
 * Mã lỗi BE thực tế (src/modules/customer/guest.service.js):
 *  - request OTP: 400 VALIDATION_ERROR, 429 RATE_LIMIT_EXCEEDED (detail: "Please wait {n}s ...")
 *  - verify OTP : 400 VALIDATION_ERROR, 401 AUTHENTICATION_ERROR (sai mã / hết hạn / không có challenge — BE dùng
 *                 chung một code), 429 RATE_LIMIT_EXCEEDED (quá 5 lần nhập sai, challenge bị hủy)
 *  - transactions: 401 AUTHENTICATION_ERROR (thiếu / sai / hết hạn lookup token)
 * Không hiển thị nguyên văn `detail` của BE cho người dùng.
 */
export type GuestLookupErrorKind =
  | 'invalid-input'
  | 'invalid-otp'
  | 'rate-limited'
  | 'too-many-attempts'
  | 'session-expired'
  | 'network'
  | 'server'
  | 'unknown';

export interface GuestLookupError {
  kind: GuestLookupErrorKind;
  message: string;
  /** Số giây phải chờ trước khi gửi lại OTP, đọc từ phản hồi 429 của BE (nếu có). */
  retryAfterSeconds?: number;
}

type GuestLookupStep = 'request-otp' | 'verify-otp' | 'transactions';

const NETWORK_MESSAGE = 'Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại.';
const SERVER_MESSAGE = 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau ít phút.';
const SESSION_EXPIRED_MESSAGE = 'Phiên tra cứu đã hết hạn. Vui lòng xác minh lại bằng mã OTP.';

export function toGuestLookupError(error: any, step: GuestLookupStep): GuestLookupError {
  const status: number | null = error?.status ?? null;
  const code: string = String(error?.data?.code || '');

  if (!status) return { kind: 'network', message: NETWORK_MESSAGE };
  if (status >= 500) return { kind: 'server', message: SERVER_MESSAGE };

  if (step === 'request-otp') {
    if (status === 400) return { kind: 'invalid-input', message: 'Số điện thoại hoặc email chưa đúng định dạng.' };
    if (status === 429 || code === 'RATE_LIMIT_EXCEEDED') {
      const retryAfterSeconds = parseRetryAfterSeconds(error?.data?.detail);
      return {
        kind: 'rate-limited',
        retryAfterSeconds,
        message: retryAfterSeconds
          ? `Bạn vừa yêu cầu mã. Vui lòng chờ ${retryAfterSeconds} giây trước khi gửi lại.`
          : 'Bạn vừa yêu cầu mã. Vui lòng chờ một lát trước khi gửi lại.',
      };
    }
  }

  if (step === 'verify-otp') {
    if (status === 400) return { kind: 'invalid-input', message: 'Mã OTP không hợp lệ. Vui lòng nhập đủ 6 chữ số.' };
    if (status === 401) return { kind: 'invalid-otp', message: 'Mã OTP không đúng hoặc đã hết hạn.' };
    if (status === 429 || code === 'RATE_LIMIT_EXCEEDED') {
      return { kind: 'too-many-attempts', message: 'Bạn đã nhập sai quá số lần cho phép. Vui lòng gửi lại mã mới.' };
    }
  }

  if (step === 'transactions' && (status === 401 || status === 403)) {
    return { kind: 'session-expired', message: SESSION_EXPIRED_MESSAGE };
  }

  return { kind: 'unknown', message: 'Không thể xử lý yêu cầu. Vui lòng thử lại.' };
}

/** BE không trả Retry-After; số giây chỉ có trong detail của 429 ("Please wait 42s ..."). */
function parseRetryAfterSeconds(detail: unknown): number | undefined {
  const match = String(detail ?? '').match(/(\d+)\s*s\b/);
  const seconds = match ? Number(match[1]) : NaN;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}

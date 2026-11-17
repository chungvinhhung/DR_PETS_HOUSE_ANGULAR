/**
 * RETURN URL / CALLBACK URL AN TOÀN (Nhiệm vụ 13).
 *
 * returnUrl đến từ query string -> người ngoài có thể sửa. Chỉ chấp nhận đường dẫn NỘI BỘ
 * để tránh lỗ hổng Open Redirect (vd. ?returnUrl=https://evil.com hoặc //evil.com).
 */

export const RETURN_URL_PARAM = 'returnUrl';
const MAX_RETURN_URL_LENGTH = 2048;

export interface ReturnUrlOptions {
  /** Chỉ chấp nhận URL bắt đầu bằng một trong các tiền tố này (vd. ['/admin/']). */
  allowedPrefixes?: readonly string[];
  /** Không bao giờ quay về các URL này (trang login, trang lỗi...) để tránh vòng lặp. */
  blockedPrefixes?: readonly string[];
}

export function sanitizeReturnUrl(value: unknown, fallback = '/', options: ReturnUrlOptions = {}): string {
  if (typeof value !== 'string') return fallback;

  let url = value.trim();
  if (!url || url.length > MAX_RETURN_URL_LENGTH) return fallback;

  // Giải mã 1 lần nếu bị encode 2 lớp (%2F%2Fevil.com)
  if (/^%2f/i.test(url)) {
    try {
      url = decodeURIComponent(url);
    } catch {
      return fallback;
    }
  }

  // Phải là đường dẫn tương đối nội bộ: bắt đầu bằng "/" nhưng không phải "//" hay "/\"
  if (!url.startsWith('/') || url.startsWith('//') || url.startsWith('/\\')) return fallback;
  // Không chứa ký tự điều khiển / scheme (javascript:, data:...)
  if (/[\u0000-\u001f\u007f]/.test(url) || /^\/*[a-z][a-z0-9+.-]*:/i.test(url.slice(1))) return fallback;

  const path = url.split(/[?#]/)[0];
  if (options.allowedPrefixes?.length && !options.allowedPrefixes.some((prefix) => path.startsWith(prefix))) {
    return fallback;
  }
  if (options.blockedPrefixes?.some((prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`))) {
    return fallback;
  }
  return url;
}

/** Quy tắc cho phía khách hàng: không được đẩy sang khu admin. */
export function sanitizeCustomerReturnUrl(value: unknown, fallback = '/'): string {
  return sanitizeReturnUrl(value, fallback, { blockedPrefixes: ['/admin'] });
}

/** Quy tắc cho trang quản trị: chỉ trong /admin/, trừ trang login & forbidden. */
export function sanitizeAdminReturnUrl(value: unknown, fallback = '/admin/dashboard'): string {
  return sanitizeReturnUrl(value, fallback, {
    allowedPrefixes: ['/admin/'],
    blockedPrefixes: ['/admin/login', '/admin/forbidden'],
  });
}

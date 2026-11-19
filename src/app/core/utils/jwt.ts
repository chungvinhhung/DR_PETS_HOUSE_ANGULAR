/**
 * Đọc payload của JWT (Bearer access token) ở phía client — CHỈ để biết thời điểm hết hạn,
 * không dùng để xác thực (việc xác thực chữ ký là của backend).
 */

export interface JwtPayload {
  exp?: number;
  iat?: number;
  sub?: string;
  [key: string]: unknown;
}

export function decodeJwtPayload(token: string | null | undefined): JwtPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = decodeURIComponent(
      Array.from(atob(padded), (char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
    );
    const payload = JSON.parse(json);
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

/** Thời điểm hết hạn (ms) hoặc null nếu token không phải JWT / không có exp. */
export function getJwtExpiresAt(token: string | null | undefined): number | null {
  const exp = decodeJwtPayload(token)?.exp;
  return typeof exp === 'number' && Number.isFinite(exp) ? exp * 1000 : null;
}

/**
 * Token đã (hoặc sắp, trong `skewMs`) hết hạn chưa.
 * Token không đọc được exp -> coi như chưa hết hạn, để backend quyết định (trả 401).
 */
export function isJwtExpired(token: string | null | undefined, skewMs = 30_000, now = Date.now()): boolean {
  const expiresAt = getJwtExpiresAt(token);
  return expiresAt !== null && expiresAt - skewMs <= now;
}

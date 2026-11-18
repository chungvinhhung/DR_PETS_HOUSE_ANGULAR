export type AppHttpErrorKind =
  | 'network'
  | 'bad-request'
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'validation'
  | 'locked'
  | 'server'
  | 'unknown';

export class AppHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly kind: AppHttpErrorKind,
    message: string,
    public readonly details: unknown = null,
  ) {
    super(message);
    this.name = 'AppHttpError';
  }
}

/** Read RFC 9457 problem codes from either a mapped error or raw HTTP body. */
export function backendProblemCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const record = error as Record<string, unknown>;
  const candidates: unknown[] = [record['details'], record['error'], error];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') continue;
    const value = (candidate as Record<string, unknown>)['code'];
    if (typeof value === 'string' && value.trim()) return value.trim().toUpperCase();
  }
  return null;
}

export function backendProblemMessage(error: unknown): string | null {
  switch (backendProblemCode(error)) {
    case 'BRANCH_SCOPE_ERROR':
      return 'Dữ liệu thuộc chi nhánh ngoài phạm vi được phân công. Vui lòng chọn lại chi nhánh được giao.';
    case 'ASSIGNMENT_SCOPE_ERROR':
      return 'Bạn không được phân công thực hiện lịch hẹn hoặc hồ sơ này.';
    case 'INVALID_STATE_TRANSITION':
      return 'Trạng thái hiện tại không cho phép thao tác này. Vui lòng tải lại thông tin và kiểm tra điều kiện thực hiện.';
    case 'CONCURRENCY_CONFLICT':
      return 'Lịch hẹn đã được người khác cập nhật. Vui lòng tải lại dữ liệu mới nhất.';
    case 'STAFF_UNAVAILABLE':
      return 'Dịch vụ chưa có nhân viên được phân công hợp lệ hoặc nhân viên đã ngưng hoạt động. Vui lòng phân công lại.';
    case 'STAFF_ROLE_MISMATCH':
      return 'Nhân viên được phân công không còn đúng vai trò chuyên môn yêu cầu. Vui lòng phân công lại.';
    case 'MODERATION_ACTION_REQUIRED':
      return 'Vui lòng duyệt hoặc từ chối bài viết trước khi thực hiện xóa.';
    case 'AUTHORIZATION_ERROR':
      return 'Bạn không có quyền thực hiện thao tác này.';
    case 'AUTHENTICATION_ERROR':
      return 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.';
    default:
      return null;
  }
}

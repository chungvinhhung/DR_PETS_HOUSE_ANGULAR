import { HttpErrorResponse } from '@angular/common/http';
import { AppHttpError } from '../../../../core/models/app-http-error.model';
import { adminErrorMessage } from '../../../../shared/services/admin-toast.service';

/**
 * User-friendly messages for RFC 9457 order/return/payment errors.
 * Never render the backend `detail` field directly in a toast: it can
 * contain internal data, English messages, or implementation details.
 */
const ORDER_ERROR_MESSAGES: Record<string, string> = {
  EMPTY_CART: 'Giỏ hàng của bạn đang trống. Vui lòng chọn sản phẩm.',
  VALIDATION_ERROR: 'Vui lòng kiểm tra và điền đầy đủ thông tin hợp lệ.',
  AUTHENTICATION_ERROR: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
  CONFLICT: 'Yêu cầu đang được xử lý hoặc dữ liệu đã thay đổi. Vui lòng kiểm tra lại.',
  INSUFFICIENT_INVENTORY: 'Một số sản phẩm không đủ hàng tại các chi nhánh. Vui lòng điều chỉnh số lượng.',
  PAYMENT_REQUIRED: 'Đơn hàng chưa hoàn tất thanh toán trực tuyến.',
  RETURN_WINDOW_EXPIRED: 'Đơn hàng đã quá thời hạn trả hàng (7 ngày sau khi giao thành công).',
  REFUND_EXCEEDS_NET_PAID: 'Số tiền hoàn vượt quá số tiền thực tế khách đã thanh toán.',
  VOUCHER_INVALID: 'Mã giảm giá không hợp lệ hoặc đơn hàng chưa đáp ứng điều kiện.',
  INVALID_STATE_TRANSITION: 'Trạng thái đã thay đổi. Vui lòng tải lại để tiếp tục.',
  RETURN_QTY_EXCEEDS_RETURNABLE: 'Số lượng trả vượt quá số lượng có thể trả.',
};

export function orderErrorMessage(error: unknown, fallback?: string): string {
  const body = error instanceof AppHttpError
    ? error.details
    : error instanceof HttpErrorResponse ? error.error : null;
  const code = body && typeof body === 'object' && 'code' in body
    ? (body as { code?: unknown }).code
    : null;
  if (typeof code === 'string' && Object.prototype.hasOwnProperty.call(ORDER_ERROR_MESSAGES, code)) {
    return ORDER_ERROR_MESSAGES[code];
  }
  return adminErrorMessage(error, fallback);
}

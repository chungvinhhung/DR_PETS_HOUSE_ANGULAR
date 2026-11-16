/**
 * Nhãn hiển thị cho dữ liệu tra cứu Guest. Chỉ dịch enum BE sang tiếng Việt, không tự suy ra trạng thái.
 * Enum lấy từ BE: Order.status, Appointment.status, Payment.status, Appointment.deposit.status.
 */
import { EMAIL_PATTERN, PHONE_PATTERN } from '../../auth/components/auth-modal.helpers';
import type { GuestOtpRequest, GuestShippingAddress } from '../models/guest-lookup.models';

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  PROCESSING: 'Đang xử lý',
  SHIPPED: 'Đang giao hàng',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

export const APPOINTMENT_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Chờ thanh toán',
  PENDING_CONFIRMATION: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  IN_PROGRESS: 'Đang thực hiện',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  NO_SHOW: 'Không đến',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  ONLINE_MOCK: 'Thanh toán trực tuyến',
  COD: 'Thanh toán khi nhận hàng',
  PAY_AT_STORE: 'Thanh toán tại cửa hàng',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  FAILED: 'Thanh toán thất bại',
  CANCELLED: 'Đã hủy',
  EXPIRED: 'Hết hạn thanh toán',
  REFUND_PENDING: 'Đang hoàn tiền',
  REFUNDED: 'Đã hoàn tiền',
};

export const DEPOSIT_STATUS_LABELS: Record<string, string> = {
  NOT_REQUIRED: 'Không yêu cầu đặt cọc',
  PENDING: 'Chờ đặt cọc',
  HELD: 'Đã giữ cọc',
  APPLIED: 'Đã trừ cọc',
  REFUNDED: 'Đã hoàn cọc',
  FORFEITED: 'Mất cọc',
};

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  GROOMING: 'Grooming & Spa',
  MEDICAL: 'Khám & Điều trị',
  MIXED: 'Grooming & Khám',
};

const STATUS_TONES: Record<string, string> = {
  PENDING: 'bg-[#fff9c4] text-[#544600]',
  PENDING_PAYMENT: 'bg-[#fff9c4] text-[#544600]',
  PENDING_CONFIRMATION: 'bg-[#fff9c4] text-[#544600]',
  CONFIRMED: 'bg-[#d9f4e4] text-[#137333]',
  PROCESSING: 'bg-[#d9f4e4] text-[#137333]',
  SHIPPED: 'bg-[#e3f2fd] text-[#0d47a1]',
  IN_PROGRESS: 'bg-[#e3f2fd] text-[#0d47a1]',
  COMPLETED: 'bg-[#dbe8ff] text-[#0d47a1]',
  CANCELLED: 'bg-[#ffdad6] text-[#ba1a1a]',
  NO_SHOW: 'bg-[#e6e8ea] text-[#44474e]',
};

export function labelOf(map: Record<string, string>, value: unknown): string {
  const key = String(value ?? '');
  return map[key] || key || 'Đang cập nhật';
}

export function statusTone(status: unknown): string {
  return STATUS_TONES[String(status ?? '')] || 'bg-[#e6e8ea] text-[#44474e]';
}

export function formatDateTime(value: unknown): string {
  if (!value) return '';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatAddress(address: GuestShippingAddress | undefined | null): string {
  if (!address) return '';
  return [
    address.line1 || address.addressLine || address.addressDetail,
    address.ward,
    address.district,
    address.city || address.province,
  ]
    .filter(Boolean)
    .join(', ');
}

/**
 * Validate contact theo validator dùng chung (auth-modal.helpers) + ràng buộc OpenAPI của BE:
 * phone `^0[0-9]{9}$`, email `format: email`. Trả về body đúng schema GuestOtpRequest, hoặc null.
 */
export function toGuestOtpRequest(rawValue: string): GuestOtpRequest | null {
  const value = rawValue.trim();
  if (value.includes('@')) {
    const email = value.toLowerCase();
    return EMAIL_PATTERN.test(email) ? { email } : null;
  }
  const phone = value.replace(/[\s.-]/g, '');
  return PHONE_PATTERN.test(phone) && /^0\d{9}$/.test(phone) ? { phone } : null;
}

/** Che bớt contact: 0901234555 -> 09******55, linh@gmail.com -> l***@gmail.com */
export function maskContact(contact: GuestOtpRequest): string {
  if ('email' in contact) {
    const [name, domain] = contact.email.split('@');
    return `${name.slice(0, 1)}***@${domain}`;
  }
  const phone = contact.phone;
  return `${phone.slice(0, 2)}${'*'.repeat(Math.max(phone.length - 4, 0))}${phone.slice(-2)}`;
}

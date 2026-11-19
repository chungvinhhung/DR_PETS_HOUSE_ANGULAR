/**
 * Model tra cứu giao dịch Guest (M02 — Guest Lookup bằng SĐT/email + OTP).
 *
 * Nguồn contract (BE `minhllk24/PET_CLINIC_BACKEND`, nhánh feat/foundation-v6):
 *  - docs/07-openapi-v6.yaml: GuestOtpRequest, GuestOtpChallenge, GuestOtpVerify, GuestLookupToken, GuestTransactionList
 *  - src/modules/customer/guest.service.js: requestGuestOtp, verifyGuestOtp, getGuestTransactions
 *  - src/modules/order/models/Order.js, src/modules/booking/models/Appointment.js
 *
 * `/guest/transactions` trả nguyên document Mongo (không qua formatOrder/formatAppointment),
 * nên mọi field đều để optional — FE chỉ hiển thị field nào BE thực sự trả về.
 */

/** Body POST /guest/lookup/otp — OpenAPI yêu cầu đúng MỘT trong hai field. */
export type GuestOtpRequest = { phone: string } | { email: string };

/** 202 POST /guest/lookup/otp. `debugOtp` chỉ có khi BE chạy môi trường không phải production. */
export interface GuestOtpChallenge {
  challengeId: string;
  /** Số giây OTP còn hiệu lực. */
  expiresIn: number;
  debugOtp?: string;
}

/** 200 POST /guest/lookup/verify. Token gửi lại qua header X-Guest-Lookup-Token. */
export interface GuestLookupToken {
  lookupToken: string;
  /** Số giây lookup token còn hiệu lực. */
  expiresIn: number;
}

export type GuestOrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED';

export type GuestAppointmentStatus =
  | 'PENDING_PAYMENT'
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export interface GuestOrderItem {
  _id?: string;
  nameSnapshot?: string;
  skuSnapshot?: string;
  image?: string;
  photoUrl?: string;
  unitPrice?: number;
  quantity?: number;
  lineSubtotal?: number;
  allocatedDiscount?: number;
  lineNet?: number;
}

/** shippingAddress là `Object` tự do trong schema; các key dưới đây là key BE đọc trong formatOrder. */
export interface GuestShippingAddress {
  recipientName?: string;
  fullName?: string;
  phone?: string;
  line1?: string;
  addressLine?: string;
  addressDetail?: string;
  ward?: string;
  district?: string;
  city?: string;
  province?: string;
}

export interface GuestOrder {
  _id: string;
  code?: string;
  status?: GuestOrderStatus;
  paymentMethod?: 'ONLINE_MOCK' | 'COD';
  payment?: { status?: string };
  items?: GuestOrderItem[];
  pricing?: {
    merchandiseSubtotal?: number;
    voucherDiscount?: number;
    shippingFee?: number;
    totalAmount?: number;
  };
  voucher?: { code?: string };
  shippingAddress?: GuestShippingAddress;
  statusHistory?: { status?: string; at?: string; note?: string }[];
  deliveredAt?: string;
  createdAt?: string;
}

export interface GuestAppointmentService {
  _id?: string;
  serviceName?: string;
  serviceType?: 'GROOMING' | 'MEDICAL';
  variantLabel?: string | null;
  unitPrice?: number;
  durationMinutes?: number;
  scheduledStart?: string;
  scheduledEnd?: string;
}

export interface GuestPetSnapshot {
  name?: string;
  species?: string;
  breed?: string;
}

export interface GuestAppointment {
  _id: string;
  code?: string;
  status?: GuestAppointmentStatus;
  serviceType?: 'GROOMING' | 'MEDICAL' | 'MIXED';
  branchId?: string;
  paymentMethod?: 'ONLINE_MOCK' | 'PAY_AT_STORE';
  services?: GuestAppointmentService[];
  scheduledStart?: string;
  scheduledEnd?: string;
  scheduledDurationMinutes?: number;
  pricing?: {
    subtotal?: number;
    voucherDiscount?: number;
    finalAmount?: number;
    depositAmount?: number;
    balanceAmount?: number;
    paidAmount?: number;
  };
  deposit?: { status?: string };
  petSnapshot?: GuestPetSnapshot | null;
  note?: string | null;
  cancel?: { reason?: string | null; at?: string | null };
  createdAt?: string;
}

/** 200 GET /guest/transactions. */
export interface GuestTransactionList {
  orders: GuestOrder[];
  appointments: GuestAppointment[];
}

export type GuestTransaction =
  | { kind: 'order'; id: string; data: GuestOrder }
  | { kind: 'appointment'; id: string; data: GuestAppointment };

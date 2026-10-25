import { HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from '../../../../core/services/api-client.service';

export type VoucherScope = 'ORDER' | 'PRODUCT' | 'SERVICE';
export type VoucherDiscountType = 'PERCENTAGE' | 'FIXED';
export type VoucherStatus = 'ACTIVE' | 'INACTIVE';
/** Fields verified against BE voucher.service.js formatVoucherResponse. */
export interface AdminVoucher {
  id: string;
  code: string;
  name: string;
  discountType: VoucherDiscountType;
  discountValue: number;
  scope: VoucherScope;
  effectiveFrom: string;
  effectiveTo: string;
  quota: number;
  usedCount: number;
  status: VoucherStatus;
  /* BE does not currently include these in formatVoucherResponse. */
  minOrderAmount?: number | null;
  maxDiscountAmount?: number | null;
  description?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}
export interface VoucherListResult {
  items: AdminVoucher[];
  nextCursor: string | null;
}
export interface VoucherWriteBody {
  code: string;
  name: string;
  discountType: VoucherDiscountType;
  discountValue: number;
  scope: VoucherScope;
  effectiveFrom: string;
  effectiveTo: string;
  quota: number;
  status: VoucherStatus;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
}
export type VoucherUpdateBody = Partial<VoucherWriteBody>;

@Injectable({ providedIn: 'root' })
export class AdminVoucherApiService {
  private readonly api = inject(ApiClientService);

  list(filters: { status?: VoucherStatus; scope?: VoucherScope; cursor?: string } = {}): Observable<VoucherListResult> {
    let params = new HttpParams().set('limit', '20');
    if (filters.status) params = params.set('status', filters.status);
    if (filters.scope) params = params.set('scope', filters.scope);
    if (filters.cursor) params = params.set('cursor', filters.cursor);
    return this.api.get<VoucherListResult>('/vouchers', { params });
  }
  get(id: string): Observable<AdminVoucher> {
    return this.api.get<AdminVoucher>('/vouchers/' + encodeURIComponent(id));
  }
  create(body: VoucherWriteBody, idempotencyKey: string): Observable<AdminVoucher> {
    return this.api.post<AdminVoucher, VoucherWriteBody>('/vouchers', body, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
    });
  }
  update(id: string, body: VoucherUpdateBody): Observable<AdminVoucher> {
    return this.api.patch<AdminVoucher, VoucherUpdateBody>('/vouchers/' + encodeURIComponent(id), body);
  }
}

export const VOUCHER_SCOPE_LABELS: Record<VoucherScope, string> = {
  ORDER: 'Tất cả đơn / giao dịch',
  PRODUCT: 'Đơn mua hàng',
  SERVICE: 'Dịch vụ',
};
export const VOUCHER_STATUS_LABELS: Record<VoucherStatus, string> = {
  ACTIVE: 'Đang bật',
  INACTIVE: 'Đã tắt',
};
export function voucherMoney(amount: number | null | undefined): string {
  return Number.isFinite(amount) ? new Intl.NumberFormat('vi-VN').format(Number(amount)) + 'đ' : '—';
}
export function voucherDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(d);
}
export function voucherOffer(voucher: AdminVoucher): string {
  return voucher.discountType === 'PERCENTAGE'
    ? 'Giảm ' + voucher.discountValue + '%'
    : 'Giảm ' + voucherMoney(voucher.discountValue);
}
export function voucherAvailability(v: AdminVoucher): string {
  const now = Date.now();
  if (v.status === 'INACTIVE') return 'Đã tắt';
  if (v.usedCount >= v.quota) return 'Hết lượt';
  if (new Date(v.effectiveFrom).getTime() > now) return 'Chưa bắt đầu';
  if (new Date(v.effectiveTo).getTime() < now) return 'Hết hạn';
  return 'Còn lượt';
}

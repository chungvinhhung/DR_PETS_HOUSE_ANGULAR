import { HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiClientService } from '../../../../core/services/api-client.service';

export interface AdminOrderQuoteRequest {
  branchId?: string;
  customerId?: string;
  items: Array<{ productId: string; variantId: string; quantity: number }>;
  voucherCode?: string;
}
export interface AdminOrderQuote {
  eligible: boolean;
  fulfillmentBranchId: string;
  pricing: {
    merchandiseSubtotal: number;
    voucherDiscount: number;
    shippingFee: number;
    totalAmount: number;
  };
  availability: { canFulfillEntireCart: boolean; blockingItems: Array<{
    sku: string; name: string; requestedQuantity: number; availableQuantity: number;
  }> };
  quoteExpiresAt: string;
}
export interface AdminOrderCommitRequest extends AdminOrderQuoteRequest {
  guestContact?: { fullName: string; phone: string; email?: string };
  paymentMethod: 'COD' | 'ONLINE_MOCK';
  shippingAddress: {
    recipientName: string; phone: string; line1: string; ward: string; district: string; city: string;
  };
  note?: string;
}
export interface AdminOrderCommitResult {
  order: { id: string; code: string; status: string };
  payment: { id: string; status: string; method: string };
  fulfillmentBranchId: string;
  guestActivationStatus?: string;
  activationInviteStatus?: string;
}
function validMoney(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
function validateQuote(value: unknown): AdminOrderQuote {
  if (!value || typeof value !== 'object') throw new Error('Chưa nhận được báo giá hợp lệ.');
  const raw=value as Partial<AdminOrderQuote>;
  const p=raw.pricing;
  if (typeof raw.eligible !== 'boolean' || !raw.fulfillmentBranchId ||
    !p || !validMoney(p.totalAmount) || !validMoney(p.merchandiseSubtotal) ||
    !validMoney(p.shippingFee) || !validMoney(p.voucherDiscount) ||
    !raw.availability || !Array.isArray(raw.availability.blockingItems) ||
    !raw.quoteExpiresAt || !Number.isFinite(Date.parse(raw.quoteExpiresAt))) {
    throw new Error('Báo giá chưa đủ thông tin để xác nhận.');
  }
  return raw as AdminOrderQuote;
}
@Injectable({ providedIn: 'root' })
export class AdminOrderCheckoutService {
  private readonly api=inject(ApiClientService);
  /** Source-verified BE foundation-v6: POST /api/v1/admin/orders/quote (no writes). */
  quote(body: AdminOrderQuoteRequest): Observable<AdminOrderQuote> {
    return this.api.post<unknown,AdminOrderQuoteRequest>('/admin/orders/quote',body).pipe(map(validateQuote));
  }
  /**
   * Real transaction: stock, voucher, Order and Payment. Only invoke after a
   * confirmed quote and explicit user confirmation. Reuse key on retries.
   */
  commit(body: AdminOrderCommitRequest,idempotencyKey:string): Observable<AdminOrderCommitResult> {
    return this.api.post<AdminOrderCommitResult,AdminOrderCommitRequest>('/admin/orders',body,{
      headers:new HttpHeaders({'Idempotency-Key':idempotencyKey}),
    });
  }
}

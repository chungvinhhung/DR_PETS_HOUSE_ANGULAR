import { HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from '../../../../core/services/api-client.service';

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'COMPLETED' | 'CANCELLED';
export type OrderPaymentMethod = 'ONLINE_MOCK' | 'COD';
export interface OrderItemRecord {
  orderItemId: string;
  productId: string;
  variantId?: string;
  skuSnapshot?: string;
  name: string;
  unitPrice: number;
  quantity: number;
  lineSubtotal: number;
  allocatedDiscount: number;
  lineNet: number;
  returnedQty?: number;
}
export interface OrderRecord {
  id: string;
  code: string;
  customerId: string | null;
  fulfillmentBranchId: string;
  status: OrderStatus;
  items: OrderItemRecord[];
  pricing: {
    merchandiseSubtotal: number;
    voucherDiscount: number;
    shippingFee: number;
    totalAmount: number;
  };
  voucherCode?: string | null;
  contactSnapshot?: { fullName?: string; name?: string; phone?: string; email?: string };
  shippingAddress?: Record<string, unknown> | string;
  paymentMethod: OrderPaymentMethod;
  payment?: { paymentId: string; status: string };
  deliveredAt?: string | null;
  returnWindowEndsAt?: string | null;
  allowedActions?: string[];
  createdAt?: string;
  statusHistory?: { status: OrderStatus; at: string; actorId?: string; note?: string }[];
}
export interface OrderListResponse {
  items: OrderRecord[];
  nextCursor?: string | null;
}

export type ReturnStatus = 'REQUESTED' | 'PROCESSING' | 'RECEIVED' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
export interface OrderReturnSummary {
  id: string;
  orderId: string;
  status: ReturnStatus;
  items: { orderItemId: string; productName: string; orderedQty: number; alreadyReturnedQty: number; requestedQty: number; refundAmount: number }[];
  refundBreakdown: { merchandiseNet: number; shippingRefunded: number; total: number };
  reason?: string;
  refundId?: string | null;
  evidenceUrls?: string[];
  history?: { status: string; at: string; actorId?: string; note?: string }[];
}
export interface OrderReturnListResponse {
  items: OrderReturnSummary[];
  nextCursor?: string | null;
}

export interface OrderRefundRecord {
  id: string;
  orderId: string;
  orderReturnId: string | null;
  amount: number;
  status: 'PENDING' | 'REFUNDED';
  provider: 'MOCK';
  refundedAt?: string | null;
}

export type ReturnStaffAction = 'process' | 'receive';
export type ReturnManagerAction = 'approve' | 'reject';
export type OrderWriteAction = 'confirm' | 'process' | 'ship' | 'mark-delivered';
@Injectable({ providedIn: 'root' })
export class AdminOrderApiService {
  private readonly api = inject(ApiClientService);

  /** BE source feat/foundation-v6 caps GET /orders at 100 and returns nextCursor:null. */
  list(): Observable<OrderListResponse> {
    return this.api.get<OrderListResponse>('/orders', {
      params: new HttpParams().set('limit', '100'),
    });
  }
  listReturns(): Observable<OrderReturnListResponse> {
    return this.api.get<OrderReturnListResponse>('/order-returns', {
      params: new HttpParams().set('limit', '100'),
    });
  }

  getReturn(id: string): Observable<OrderReturnSummary> {
    return this.api.get<OrderReturnSummary>('/order-returns/' + encodeURIComponent(id));
  }
  returnStaffAction(id: string, action: ReturnStaffAction): Observable<OrderReturnSummary> {
    return this.api.post<OrderReturnSummary, Record<string, never>>(
      '/order-returns/' + encodeURIComponent(id) + '/' + action, {});
  }
  returnManagerAction(id: string, action: ReturnManagerAction, body: { note?: string; reason?: string }): Observable<OrderReturnSummary> {
    return this.api.post<OrderReturnSummary, { note?: string; reason?: string }>(
      '/order-returns/' + encodeURIComponent(id) + '/' + action, body);
  }
  getRefund(id: string): Observable<OrderRefundRecord> {
    return this.api.get<OrderRefundRecord>('/order-refunds/' + encodeURIComponent(id));
  }
  processRefund(id: string, key: string): Observable<OrderRefundRecord> {
    return this.api.post<OrderRefundRecord, Record<string, never>>(
      '/order-refunds/' + encodeURIComponent(id) + '/process', {},
      { headers: new HttpHeaders({ 'Idempotency-Key': key }) });
  }

  get(id: string): Observable<OrderRecord> {
    return this.api.get<OrderRecord>('/orders/' + encodeURIComponent(id));
  }
  changeStatus(id: string, action: OrderWriteAction, shipping?: { carrier?: string; trackingNumber?: string }): Observable<OrderRecord> {
    return this.api.post<OrderRecord, object>(
      '/orders/' + encodeURIComponent(id) + '/' + action,
      action === 'ship' ? (shipping ?? {}) : {},
    );
  }
  cancel(id: string, reason: string, idempotencyKey: string): Observable<OrderRecord> {
    return this.api.post<OrderRecord, { reason: string }>(
      '/orders/' + encodeURIComponent(id) + '/staff-cancel',
      { reason },
      { headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }) },
    );
  }
}

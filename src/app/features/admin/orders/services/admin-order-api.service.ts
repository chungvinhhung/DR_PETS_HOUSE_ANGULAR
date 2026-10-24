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
  items: { orderItemId: string; productName: string; requestedQty: number; refundAmount: number }[];
  refundBreakdown: { merchandiseNet: number; shippingRefunded: number; total: number };
  history?: { status: string; at: string }[];
}
export interface OrderReturnListResponse {
  items: OrderReturnSummary[];
  nextCursor?: string | null;
}

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

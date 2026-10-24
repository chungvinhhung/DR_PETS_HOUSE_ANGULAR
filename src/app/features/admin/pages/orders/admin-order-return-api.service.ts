import { HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from '../../../../core/services/api-client.service';

export interface AdminOrderItem {
  orderItemId: string;
  productId: string;
  name: string;
  skuSnapshot?: string;
  quantity: number;
  returnedQty: number;
  unitPrice: number;
  lineSubtotal: number;
  allocatedDiscount: number;
  lineNet: number;
}
export interface AdminOrder {
  id: string;
  code: string;
  status: string;
  fulfillmentBranchId: string;
  items: AdminOrderItem[];
  pricing: {
    merchandiseSubtotal: number;
    voucherDiscount: number;
    shippingFee: number;
    totalAmount: number;
  };
  voucherCode?: string | null;
  createdAt?: string;
  deliveredAt?: string | null;
  returnWindowEndsAt?: string | null;
  allowedActions?: string[];
}
export interface AdminReturnLine {
  orderItemId: string;
  productName: string;
  orderedQty: number;
  alreadyReturnedQty: number;
  requestedQty: number;
  refundAmount: number;
}
export interface AdminReturn {
  id: string;
  orderId: string;
  status: string;
  items: AdminReturnLine[];
  reason: string;
  refundId?: string | null;
  refundBreakdown: { merchandiseNet: number; shippingRefunded: 0; total: number };
  history?: { status: string; at: string; note?: string }[];
}
export interface ReturnableItem {
  orderItemId: string;
  orderedQty: number;
  alreadyReturnedQty: number;
  returnableQty: number;
  maxRefundEstimate: number;
}
export interface ReturnableResponse {
  orderId: string;
  eligible: boolean;
  returnWindowEndsAt: string | null;
  items: ReturnableItem[];
}
export interface ReturnQuote {
  orderId: string;
  eligible: boolean;
  returnWindowEndsAt: string;
  items: { orderItemId: string; requestedQty: number; returnableQty: number; refundAmount: number }[];
  refundBreakdown: { merchandiseNet: number; shippingRefunded: 0; total: number };
}
export interface AdminRefund {
  id: string;
  orderId: string;
  orderReturnId?: string | null;
  amount: number;
  status: string;
  provider: 'MOCK';
  refundedAt?: string | null;
}
export interface CursorList<T> { items: T[]; nextCursor?: string | null; }
export interface ReturnQuantity { orderItemId: string; quantity: number; }

@Injectable({ providedIn: 'root' })
export class AdminOrderReturnApiService {
  private readonly api = inject(ApiClientService);

  listOrders(): Observable<CursorList<AdminOrder>> {
    return this.api.get<CursorList<AdminOrder>>('/orders', {
      params: new HttpParams().set('limit', '100'),
    });
  }
  listReturns(): Observable<CursorList<AdminReturn>> {
    return this.api.get<CursorList<AdminReturn>>('/order-returns', {
      params: new HttpParams().set('limit', '100'),
    });
  }
  getOrder(id: string): Observable<AdminOrder> {
    return this.api.get<AdminOrder>('/orders/' + encodeURIComponent(id));
  }
  returnableItems(id: string): Observable<ReturnableResponse> {
    return this.api.get<ReturnableResponse>(
      '/orders/' + encodeURIComponent(id) + '/returnable-items',
    );
  }
  returnQuote(id: string, items: ReturnQuantity[]): Observable<ReturnQuote> {
    return this.api.post<ReturnQuote>(
      '/orders/' + encodeURIComponent(id) + '/return-quote', { items },
    );
  }
  createReturn(
    orderId: string, items: ReturnQuantity[], reason: string, key: string,
    evidenceUrls: string[] = [],
  ): Observable<AdminReturn> {
    return this.api.post<AdminReturn>(
      '/order-returns', { orderId, items, reason, evidenceUrls }, {
        headers: new HttpHeaders({ 'Idempotency-Key': key }),
      },
    );
  }
  processReturn(id: string): Observable<AdminReturn> {
    return this.api.post<AdminReturn>('/order-returns/' + encodeURIComponent(id) + '/process', {});
  }
  receiveReturn(id: string): Observable<AdminReturn> {
    return this.api.post<AdminReturn>('/order-returns/' + encodeURIComponent(id) + '/receive', {});
  }
  approveReturn(id: string): Observable<AdminReturn> {
    return this.api.post<AdminReturn>('/order-returns/' + encodeURIComponent(id) + '/approve', {});
  }
  rejectReturn(id: string, reason: string): Observable<AdminReturn> {
    return this.api.post<AdminReturn>(
      '/order-returns/' + encodeURIComponent(id) + '/reject', { reason },
    );
  }
  getRefund(id: string): Observable<AdminRefund> {
    return this.api.get<AdminRefund>('/order-refunds/' + encodeURIComponent(id));
  }
  /** BE v7 uses a MOCK provider; never claim a real-world money transfer. */
  processMockRefund(id: string, key: string): Observable<AdminRefund> {
    return this.api.post<AdminRefund>(
      '/order-refunds/' + encodeURIComponent(id) + '/process', {}, {
        headers: new HttpHeaders({ 'Idempotency-Key': key }),
      },
    );
  }
}

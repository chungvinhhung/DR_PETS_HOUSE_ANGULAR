import { HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EMPTY, expand, map, Observable, reduce } from 'rxjs';
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
  /** Expected delivery timestamp when provided by the Order API; absent is not inferred. */
  expectedDeliveryAt?: string | null;
  deliveredAt?: string | null;
  returnWindowEndsAt?: string | null;
  allowedActions?: string[];
  createdAt?: string;
  statusHistory?: { status: OrderStatus; at: string; actorId?: string; note?: string }[];
}
export interface OrderListResponse {
  items: OrderRecord[];
  totalCount?: number;
  nextCursor?: string | null;
}

export type ReturnStatus = 'REQUESTED' | 'PROCESSING' | 'RECEIVED' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
export interface OrderReturnSummary {
  id: string;
  code?: string;
  orderId: string;
  orderCode?: string | null;
  fulfillmentBranchId?: string | null;
  createdAt?: string;
  allowedActions?: string[];
  status: ReturnStatus;
  items: {
    orderItemId: string; productName: string; orderedQty: number;
    alreadyReturnedQty: number; requestedQty: number; refundAmount: number;
    /** Optional fields: only display them if the backend actually supplies them. */
    receivedQty?: number | null; approvedQty?: number | null; finalRefundAmount?: number | null;
    quality?: 'RESELLABLE' | 'DAMAGED' | 'DISCARDED';
  }[];
  refundBreakdown: { merchandiseNet: number; shippingRefunded: number; total: number };
  /** Optional authoritative settled amount when BE adds it to the Return DTO. */
  finalRefundAmount?: number | null;
  reason?: string;
  refundId?: string | null;
  evidenceUrls?: string[];
  history?: { status: string; at: string; actorId?: string; note?: string }[];
}
export interface OrderReturnListResponse {
  items: OrderReturnSummary[];
  totalCount?: number;
  nextCursor?: string | null;
}

export interface OrderRefundRecord {
  id: string;
  orderId: string;
  orderReturnId: string | null;
  amount: number;
  status: 'PENDING' | 'REFUNDED' | 'FAILED';
  provider: 'MOCK';
  refundedAt?: string | null;
}

export type ReturnStaffAction = 'process' | 'receive';
export interface ReturnInspectionBody {
  items: Array<{orderItemId:string;receivedQty:number;quality:'RESELLABLE'|'DAMAGED'|'DISCARDED'}>;
  note?: string;
}
export type ReturnManagerAction = 'approve' | 'reject';
export type OrderWriteAction = 'confirm' | 'process' | 'ship' | 'mark-delivered';
@Injectable({ providedIn: 'root' })
export class AdminOrderApiService {
  private readonly api = inject(ApiClientService);

  private listAll<T>(path:string, resource:string): Observable<{items:T[];totalCount?:number;nextCursor?:string|null}> {
    const fetch=(cursor?:string)=>this.api.get<unknown>(path,{
      params:cursor
        ? new HttpParams().set('limit','100').set('cursor',cursor)
        : new HttpParams().set('limit','100'),
    }).pipe(map(response=>this.requirePage<T>(response,resource)));
    return fetch().pipe(
      expand(page=>page.nextCursor?fetch(page.nextCursor):EMPTY),
      reduce((all,page)=>({
        items:[...all.items,...page.items],
        totalCount:all.totalCount??page.totalCount,
        nextCursor:page.nextCursor??null,
      }),{items:[] as T[],totalCount:undefined as number|undefined,nextCursor:null as string|null}),
    );
  }

  list(): Observable<OrderListResponse> {
    return this.listAll<OrderRecord>('/orders','Đơn hàng');
  }
  listReturns(): Observable<OrderReturnListResponse> {
    return this.listAll<OrderReturnSummary>('/order-returns','Trả hàng');
  }

  /**
   * Do not turn HTTP 200 with an unexpected response shape into a fake empty state.
   * The admin UI can only display "no records" for an actual items: [] response.
   */
  private requirePage<T>(response: unknown, resource: string): { items: T[]; totalCount?: number; nextCursor?: string | null } {
    if (!response || typeof response !== 'object' || !('items' in response) ||
        !Array.isArray((response as { items: unknown }).items)) {
      throw new Error('API ' + resource + ' trả về sai cấu trúc danh sách.');
    }
    return response as { items: T[]; totalCount?: number; nextCursor?: string | null };
  }

  getReturn(id: string): Observable<OrderReturnSummary> {
    return this.api.get<OrderReturnSummary>('/order-returns/' + encodeURIComponent(id));
  }
  returnStaffAction(id: string, action: ReturnStaffAction, body?: ReturnInspectionBody): Observable<OrderReturnSummary> {
    return this.api.post<OrderReturnSummary, ReturnInspectionBody | Record<string, never>>(
      '/order-returns/' + encodeURIComponent(id) + '/' + action,
      action === 'receive' ? (body ?? {items:[]}) : {});
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
  changeStatus(
    id: string,
    action: OrderWriteAction,
    body?: { carrier?: string; trackingNumber?: string; note?: string },
  ): Observable<OrderRecord> {
    const payload: { carrier?: string; trackingNumber?: string; note?: string } = {};
    if (body?.note) payload.note = body.note;
    if (action === 'ship') {
      if (body?.carrier) payload.carrier = body.carrier;
      if (body?.trackingNumber) payload.trackingNumber = body.trackingNumber;
    }
    return this.api.post<OrderRecord, object>(
      '/orders/' + encodeURIComponent(id) + '/' + action,
      payload,
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

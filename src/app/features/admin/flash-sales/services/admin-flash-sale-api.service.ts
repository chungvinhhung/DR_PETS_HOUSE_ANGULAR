import { HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiClientService } from '../../../../core/services/api-client.service';

/**
 * Proposed WEB 2 contract (NOT present in foundation-v6 BE as of 2026-11-05).
 * No FE-seeded or locally persisted Flash Sale data. The BE is authoritative
 * for price, allocation, time, checkout eligibility, quota and lifecycle.
 */
export type FlashSalePublishState = 'DRAFT' | 'PUBLISHED';
export type FlashSaleActivationMode = 'AUTO' | 'MANUAL';
export type FlashSaleDisplayState = 'DRAFT' | 'UPCOMING' | 'RUNNING' | 'PAUSED' | 'ENDED';

export interface FlashSaleItem {
  productId: string;
  variantId: string;
  sku: string;
  productName: string;
  variantName: string;
  originalPrice: number;
  salePrice: number;
  quantityLimit: number;
  soldQuantity: number;
  /** Optional BE aggregate for this exact SKU, not the whole product. */
  totalStock?: number | null;
  imageUrl?: string | null;
}

export interface AdminFlashSale {
  id: string;
  name: string;
  description: string;
  startAt: string;
  endAt: string;
  status: FlashSalePublishState;
  isPaused: boolean;
  /** AUTO becomes eligible at startAt, MANUAL stays paused until Admin enables it. */
  activationMode?: FlashSaleActivationMode;
  items: FlashSaleItem[];
  /** Optimistic concurrency token returned by BE. */
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface FlashSaleItemWrite {
  productId: string;
  variantId: string;
  sku: string;
  productName: string;
  variantLabel: string;
  originalPrice: number;
  salePrice: number;
  quantityLimit: number;
}
export interface FlashSaleWriteBody {
  name: string;
  description: string;
  startAt: string;
  endAt: string;
  items: FlashSaleItemWrite[];
  /** MANUAL must remain disabled at startAt until Admin explicitly turns it on. */
  activationMode: FlashSaleActivationMode;
  isPaused: boolean;
  expectedVersion?: number;
}
export interface FlashSalePage {
  items: AdminFlashSale[];
  nextCursor: string | null;
  totalCount?: number;
}

export function flashSaleState(sale: AdminFlashSale, now = Date.now()): FlashSaleDisplayState {
  if (sale.status === 'DRAFT') return 'DRAFT';
  const from = Date.parse(sale.startAt);
  const to = Date.parse(sale.endAt);
  if (Number.isNaN(from) || Number.isNaN(to)) return 'DRAFT';
  if (to <= now) return 'ENDED';
  if (sale.isPaused) return 'PAUSED';
  return from > now ? 'UPCOMING' : 'RUNNING';
}
export const FLASH_SALE_STATE_LABELS: Record<FlashSaleDisplayState, string> = {
  DRAFT: 'Bản nháp',
  UPCOMING: 'Sắp diễn ra',
  RUNNING: 'Đang diễn ra',
  PAUSED: 'Tạm ngừng',
  ENDED: 'Đã kết thúc',
};
export function flashSaleDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}
export function flashSaleMoney(value: number): string {
  return Number.isFinite(value) ? new Intl.NumberFormat('vi-VN').format(value) + 'đ' : '—';
}
function asSale(value: unknown): AdminFlashSale {
  if (!value || typeof value !== 'object') throw new Error('Dữ liệu Flash Sale không hợp lệ.');
  const sale = value as Partial<AdminFlashSale>;
  if (typeof sale.id !== 'string' || !sale.id ||
      typeof sale.name !== 'string' ||
      !['DRAFT', 'PUBLISHED'].includes(String(sale.status)) ||
      typeof sale.isPaused !== 'boolean' || typeof sale.startAt !== 'string' ||
      typeof sale.endAt !== 'string' || !Array.isArray(sale.items)) {
    throw new Error('Thông tin Flash Sale chưa thể hiển thị. Vui lòng thử lại sau.');
  }
  // foundation-v6 returns variantLabel; keep the view's variantName stable.
  const items = sale.items.map(raw => {
    const item = raw as FlashSaleItem & {variantLabel?: string | null};
    return {
      ...item,
      productName: item.productName || 'Sản phẩm chưa có tên',
      variantName: item.variantLabel || item.variantName || 'Mặc định',
      imageUrl: item.imageUrl || null,
    };
  });
  return {...sale, description: sale.description ?? '', items} as AdminFlashSale;
}

@Injectable({ providedIn: 'root' })
export class AdminFlashSaleApiService {
  private readonly api = inject(ApiClientService);
  private readonly root = '/flash-sales';

  list(filters: {search?: string; state?: FlashSaleDisplayState | 'ALL'; cursor?: string | null; limit?: number} = {}): Observable<FlashSalePage> {
    // The Admin UI only manages scheduled/published sales. Historical DRAFT records are retained by BE, not surfaced here.
    let params = new HttpParams().set('limit', String(filters.limit ?? 10)).set('status', 'PUBLISHED');
    if (filters.search?.trim()) params = params.set('search', filters.search.trim());
    if (filters.state && filters.state !== 'ALL') params = params.set('derivedStatus', filters.state);
    if (filters.cursor) params = params.set('cursor', filters.cursor);
    return this.api.get<unknown>(this.root, {params}).pipe(map(response => {
      if (!response || typeof response !== 'object' ||
          !('items' in response) || !Array.isArray(response.items)) {
        throw new Error('Danh sách Flash Sale chưa thể hiển thị. Vui lòng thử lại sau.');
      }
      const raw = response as {items: unknown[]; nextCursor?: unknown; totalCount?: unknown};
      return {
        items: raw.items.map(asSale),
        nextCursor: typeof raw.nextCursor === 'string' ? raw.nextCursor : null,
        ...(typeof raw.totalCount === 'number' ? {totalCount: raw.totalCount} : {}),
      };
    }));
  }

  get(id: string): Observable<AdminFlashSale> {
    return this.api.get<unknown>(this.root + '/' + encodeURIComponent(id)).pipe(map(asSale));
  }
  /** Atomic create+publish: no intermediate DRAFT is exposed or silently retained. */
  createPublished(body: FlashSaleWriteBody, key: string): Observable<AdminFlashSale> {
    return this.api.post<unknown, FlashSaleWriteBody & {status: 'PUBLISHED'}>(
      this.root, {...body, status: 'PUBLISHED'}, {
        headers: new HttpHeaders({'Idempotency-Key': key}),
      },
    ).pipe(map(asSale));
  }
  update(id: string, body: FlashSaleWriteBody): Observable<AdminFlashSale> {
    return this.api.patch<unknown, FlashSaleWriteBody>(
      this.root + '/' + encodeURIComponent(id), body,
    ).pipe(map(asSale));
  }
  /** Compatibility for historical DRAFT records; BE must update and publish atomically. */
  updateAndPublish(id: string, body: FlashSaleWriteBody): Observable<AdminFlashSale> {
    return this.api.patch<unknown, FlashSaleWriteBody & {status: 'PUBLISHED'}>(
      this.root + '/' + encodeURIComponent(id), {...body, status: 'PUBLISHED'},
    ).pipe(map(asSale));
  }
  publish(id: string, key: string, isPaused: boolean, activationMode: FlashSaleActivationMode): Observable<AdminFlashSale> {
    // BE must commit publication, scheduling mode and initial pause atomically.
    return this.api.post<unknown, {isPaused: boolean; activationMode: FlashSaleActivationMode}>(
      this.root + '/' + encodeURIComponent(id) + '/publish',
      {isPaused, activationMode},
      {headers: new HttpHeaders({'Idempotency-Key': key})},
    ).pipe(map(asSale));
  }
  setPaused(id: string, isPaused: boolean, activationMode: FlashSaleActivationMode): Observable<AdminFlashSale> {
    return this.api.patch<unknown, {isPaused: boolean; activationMode: FlashSaleActivationMode}>(
      this.root + '/' + encodeURIComponent(id) + '/pause', {isPaused, activationMode},
    ).pipe(map(asSale));
  }
}

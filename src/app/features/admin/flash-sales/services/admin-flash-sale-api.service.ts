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
  items: FlashSaleItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface FlashSaleItemWrite {
  productId: string;
  variantId: string;
  salePrice: number;
  quantityLimit: number;
}
export interface FlashSaleWriteBody {
  name: string;
  description: string;
  startAt: string;
  endAt: string;
  items: FlashSaleItemWrite[];
}
export interface FlashSalePage {
  items: AdminFlashSale[];
  nextCursor: string | null;
  totalCount?: number;
}

export function flashSaleState(sale: AdminFlashSale, now = Date.now()): FlashSaleDisplayState {
  if (sale.status === 'DRAFT') return 'DRAFT';
  if (sale.isPaused) return 'PAUSED';
  const from = Date.parse(sale.startAt);
  const to = Date.parse(sale.endAt);
  if (Number.isNaN(from) || Number.isNaN(to)) return 'DRAFT';
  if (to <= now) return 'ENDED';
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
    throw new Error('Hợp đồng dữ liệu Flash Sale chưa đồng bộ với Backend.');
  }
  return {...sale, description: sale.description ?? ''} as AdminFlashSale;
}

@Injectable({ providedIn: 'root' })
export class AdminFlashSaleApiService {
  private readonly api = inject(ApiClientService);
  private readonly root = '/flash-sales';

  list(filters: {search?: string; state?: FlashSaleDisplayState | 'ALL'; cursor?: string | null; limit?: number} = {}): Observable<FlashSalePage> {
    let params = new HttpParams().set('limit', String(filters.limit ?? 10));
    if (filters.search?.trim()) params = params.set('search', filters.search.trim());
    if (filters.state && filters.state !== 'ALL') params = params.set('state', filters.state);
    if (filters.cursor) params = params.set('cursor', filters.cursor);
    return this.api.get<unknown>(this.root, {params}).pipe(map(response => {
      if (!response || typeof response !== 'object' ||
          !('items' in response) || !Array.isArray(response.items)) {
        throw new Error('Hợp đồng danh sách Flash Sale chưa đồng bộ với Backend.');
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
  create(body: FlashSaleWriteBody, key: string): Observable<AdminFlashSale> {
    return this.api.post<unknown, FlashSaleWriteBody>(this.root, body, {
      headers: new HttpHeaders({'Idempotency-Key': key}),
    }).pipe(map(asSale));
  }
  update(id: string, body: FlashSaleWriteBody): Observable<AdminFlashSale> {
    return this.api.patch<unknown, FlashSaleWriteBody>(
      this.root + '/' + encodeURIComponent(id), body,
    ).pipe(map(asSale));
  }
  publish(id: string, key: string): Observable<AdminFlashSale> {
    return this.api.post<unknown, Record<string, never>>(
      this.root + '/' + encodeURIComponent(id) + '/publish', {},
      {headers: new HttpHeaders({'Idempotency-Key': key})},
    ).pipe(map(asSale));
  }
  setPaused(id: string, isPaused: boolean): Observable<AdminFlashSale> {
    return this.api.patch<unknown, {isPaused: boolean}>(
      this.root + '/' + encodeURIComponent(id) + '/pause', {isPaused},
    ).pipe(map(asSale));
  }
}

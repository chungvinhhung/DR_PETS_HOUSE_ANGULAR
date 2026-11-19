import { HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EMPTY, expand, map, Observable, reduce } from 'rxjs';
import { ApiClientService } from '../../../../core/services/api-client.service';
import { AdminProductService } from '../../products/services/admin-product.service';
import { AdminProduct } from '../../products/models/admin-product.model';

export interface InventoryItemDto {
  id: string;
  sku: string;
  name: string;
  kind: 'PRODUCT' | 'MATERIAL';
  unit: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface InventoryStockDto {
  branchId: string;
  inventoryItemId: string;
  quantity: number;
  lowStock: boolean;
  lowStockThreshold: number;
  version: number;
}

export interface InventoryTransactionLineDto {
  inventoryItemId: string;
  sku?: string | null;
  name?: string | null;
  unit?: string | null;
  quantity: number;
  beforeQty: number;
  changeQty: number;
  afterQty: number;
}

export interface InventoryTransactionDto {
  id: string;
  branchId: string;
  inventoryItemId: string;
  transactionType: 'RECEIPT' | 'ISSUE' | 'ADJUSTMENT' | 'TRANSFER';
  beforeQty: number;
  changeQty: number;
  afterQty: number;
  actorId: string;
  actorName?: string | null;
  actorRole?: string | null;
  branchName?: string | null;
  branchCode?: string | null;
  reason: string;
  createdAt: string;
  sourceType: string;
  sourceId?: string | null;
  sourceCode?: string | null;
  referenceCode?: string | null;
  transactionCode?: string | null;
  groupCode?: string | null;
  code?: string | null;
  serviceRecordId?: string | null;
  serviceRecordCode?: string | null;
  recordVersion?: number | null;
  items?: InventoryTransactionLineDto[];
}

export interface InventoryTransactionFilters {
  branchId?: string;
  inventoryItemId?: string;
  transactionType?: InventoryTransactionDto['transactionType'];
  sourceType?: string;
  sourceId?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
}

export interface InventoryBranchDto {
  id: string;
  code: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface InventoryCursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface InventoryMovementWrite {
  branchId: string;
  inventoryItemId: string;
  quantity: number;
  reason: string;
}

export interface InventoryTransferWrite {
  fromBranchId: string;
  toBranchId: string;
  inventoryItemId: string;
  quantity: number;
  reason: string;
}

@Injectable({ providedIn: 'root' })
export class AdminInventoryService {
  private readonly api = inject(ApiClientService);
  private readonly productsApi = inject(AdminProductService);

  // The API uses cursor pagination, while the approved UI uses numbered pages.
  // Read bounded result sets and paginate/filter them in the view.
  private allPages<T>(fetch: (cursor?: string) => Observable<InventoryCursorPage<T>>): Observable<T[]> {
    return fetch().pipe(
      map(page => ({ page, index: 1 })),
      expand(({ page, index }) =>
        page.nextCursor && index < 30
          ? fetch(page.nextCursor).pipe(map(next => ({ page: next, index: index + 1 })))
          : EMPTY,
      ),
      reduce((items, { page }) => items.concat(page.items), [] as T[]),
    );
  }

  listCatalogProducts(): Observable<AdminProduct[]> {
    return this.allPages(cursor => this.productsApi.listProducts({ limit: 100, cursor }));
  }

  listBranches(): Observable<InventoryBranchDto[]> {
    return this.allPages(cursor => {
      let params = new HttpParams().set('limit', '100');
      if (cursor) params = params.set('cursor', cursor);
      return this.api.get<InventoryCursorPage<InventoryBranchDto>>('/branches', { params });
    });
  }

  listItems(): Observable<InventoryItemDto[]> {
    return this.allPages(cursor => {
      let params = new HttpParams().set('limit', '100');
      if (cursor) params = params.set('cursor', cursor);
      return this.api.get<InventoryCursorPage<InventoryItemDto>>('/inventory/items', { params });
    });
  }

  listStocks(branchId = ''): Observable<InventoryStockDto[]> {
    return this.allPages(cursor => {
      let params = new HttpParams().set('limit', '100');
      if (cursor) params = params.set('cursor', cursor);
      if (branchId) params = params.set('branchId', branchId);
      return this.api.get<InventoryCursorPage<InventoryStockDto>>('/inventory/stocks', { params });
    });
  }

  listTransactions(filters: InventoryTransactionFilters = {}): Observable<InventoryTransactionDto[]> {
    return this.allPages(cursor => {
      let params = new HttpParams().set('limit', '100');
      if (cursor) params = params.set('cursor', cursor);
      if (filters.branchId) params = params.set('branchId', filters.branchId);
      if (filters.inventoryItemId) params = params.set('inventoryItemId', filters.inventoryItemId);
      if (filters.transactionType) params = params.set('transactionType', filters.transactionType);
      if (filters.sourceType) params = params.set('sourceType', filters.sourceType);
      if (filters.sourceId) params = params.set('sourceId', filters.sourceId);
      if (filters.search) params = params.set('search', filters.search);
      if (filters.fromDate) params = params.set('fromDate', filters.fromDate);
      if (filters.toDate) params = params.set('toDate', filters.toDate);
      return this.api.get<InventoryCursorPage<InventoryTransactionDto>>('/inventory/transactions', { params });
    });
  }

  receive(body: InventoryMovementWrite, key: string): Observable<InventoryTransactionDto> {
    return this.writeMovement('/inventory/receive', body, key);
  }

  issue(body: InventoryMovementWrite, key: string): Observable<InventoryTransactionDto> {
    return this.writeMovement('/inventory/issue', body, key);
  }

  adjust(body: InventoryMovementWrite, key: string): Observable<InventoryTransactionDto> {
    return this.writeMovement('/inventory/adjust', body, key);
  }

  transfer(body: InventoryTransferWrite, key: string): Observable<unknown> {
    return this.api.post('/inventory/transfer', body, { headers: this.idempotencyHeaders(key) });
  }

  setThreshold(
    branchId: string,
    itemId: string,
    lowStockThreshold: number,
    expectedVersion: number,
    key: string,
  ): Observable<InventoryStockDto> {
    const path = '/inventory/stocks/' + encodeURIComponent(branchId)
      + '/' + encodeURIComponent(itemId) + '/threshold';
    return this.api.put<InventoryStockDto>(path, { lowStockThreshold, expectedVersion }, {
      headers: this.idempotencyHeaders(key),
    });
  }

  private writeMovement(path: string, body: InventoryMovementWrite, key: string): Observable<InventoryTransactionDto> {
    return this.api.post<InventoryTransactionDto, InventoryMovementWrite>(path, body, {
      headers: this.idempotencyHeaders(key),
    });
  }

  private idempotencyHeaders(key: string): HttpHeaders {
    return new HttpHeaders({ 'Idempotency-Key': key });
  }
}

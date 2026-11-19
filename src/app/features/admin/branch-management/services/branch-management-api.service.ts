import { HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EMPTY, expand, forkJoin, map, Observable, reduce } from 'rxjs';

import { ApiClientService } from '../../../../core/services/api-client.service';
import { CatalogService } from '../../service-catalog/models/service-catalog.model';
import { ServiceCatalogApiService } from '../../service-catalog/services/service-catalog-api.service';

/** Confirmed against PET_CLINIC_BACKEND feat/foundation-v6 Branch routes / DTOs. */
export interface BranchApiRecord {
  id: string;
  code: string;
  name: string;
  address: string;
  phone?: string;
  status: 'ACTIVE' | 'INACTIVE';
  openingHours?: readonly { dayOfWeek: number; open: string; close: string }[];
  holidays?: readonly { date: string; note?: string }[];
}
/** Canonical BE OPS-03 branch shift template DTO. */
export interface BranchShiftTemplate {
  id: string;
  branchId: string;
  code?: string | null;
  name: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  status: 'ACTIVE' | 'INACTIVE';
  version?: number;
}

export interface BranchShiftTemplateWrite {
  name: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  status: 'ACTIVE' | 'INACTIVE';
}

export interface BranchServiceApiRecord {
  branchId: string;
  serviceId: string;
  enabled: boolean;
  capacity: number;
  availability: readonly { dayOfWeek: number; open: string; close: string }[];
  updatedAt?: string;
}
interface CursorPage<T> {
  items: T[];
  nextCursor?: string | null;
}
export interface BranchServiceView {
  service: CatalogService;
  config: BranchServiceApiRecord | null;
}
export interface BranchInventorySummary {
  branchId: string;
  totalItems: number;
  lowStockItems: number;
  outOfStockItems: number;
}
export interface BranchServiceBlockedWindow {
  id: string;
  startAt: string;
  endAt: string;
  reason: string;
  createdBy?: string | null;
  createdAt?: string | null;
}
interface BranchServiceBlockedWindowsResponse {
  branchId: string;
  serviceId: string;
  blockedWindows: BranchServiceBlockedWindow[];
}

/**
 * Live BE availability returns bookedCount/heldCount/occupiedCount/totalCount
 * per slot. Admin UI reads those authoritative values and does not derive
 * occupancy from configured capacity on the client.
 */
export interface ServiceAvailabilitySlot {
  start: string;
  end: string;
  remaining: number;
  bookedCount?: number;
  heldCount?: number;
  occupiedCount?: number;
  totalCount?: number;
  status?: 'AVAILABLE' | 'FULL' | 'BLOCKED' | string;
}
export interface ServiceAvailabilityResponse {
  branchId: string;
  serviceIds: readonly string[];
  date: string;
  slots: readonly ServiceAvailabilitySlot[];
}
export interface BranchOperationSlotsResponse {
  branchId: string;
  date: string;
  servicesCount: number;
  servicesAvailability: readonly ServiceAvailabilityResponse[];
}

/** No Figma demo fallback: errors propagate to the page and display retry. */
@Injectable({ providedIn: 'root' })
export class BranchManagementApiService {
  private readonly api = inject(ApiClientService);
  private readonly catalog = inject(ServiceCatalogApiService);

  private getAllPages<T>(path: string): Observable<T[]> {
    const fetchPage = (cursor?: string): Observable<CursorPage<T>> => {
      let params = new HttpParams().set('limit', '100');
      if (cursor) params = params.set('cursor', cursor);
      return this.api.get<CursorPage<T>>(path, { params });
    };
    return fetchPage().pipe(
      expand((page, index) => page.nextCursor && index < 19
        ? fetchPage(page.nextCursor)
        : EMPTY),
      reduce((all, page) => [...all, ...page.items], [] as T[]),
    );
  }

  /** OPS-03: live shift templates scoped to one selected branch. */
  listShiftTemplates(branchId: string): Observable<BranchShiftTemplate[]> {
    return this.api.get<BranchShiftTemplate[]>(
      '/branches/' + encodeURIComponent(branchId) + '/shift-templates',
    );
  }

  createShiftTemplate(branchId: string, body: BranchShiftTemplateWrite): Observable<BranchShiftTemplate> {
    return this.api.post<BranchShiftTemplate, BranchShiftTemplateWrite>(
      '/branches/' + encodeURIComponent(branchId) + '/shift-templates', body,
    );
  }

  updateShiftTemplate(branchId: string, id: string, body: BranchShiftTemplateWrite): Observable<BranchShiftTemplate> {
    return this.api.patch<BranchShiftTemplate, BranchShiftTemplateWrite>(
      '/branches/' + encodeURIComponent(branchId) + '/shift-templates/' + encodeURIComponent(id), body,
    );
  }

  deleteShiftTemplate(branchId: string, id: string): Observable<unknown> {
    return this.api.delete(
      '/branches/' + encodeURIComponent(branchId) + '/shift-templates/' + encodeURIComponent(id),
    );
  }

  listBranches(): Observable<BranchApiRecord[]> {
    return this.getAllPages<BranchApiRecord>('/branches');
  }

  getBranch(id: string): Observable<BranchApiRecord> {
    return this.api.get<BranchApiRecord>('/branches/' + encodeURIComponent(id));
  }

  createBranch(payload: {
    name: string; address: string; phone?: string; status: 'ACTIVE' | 'INACTIVE';
  }, idempotencyKey: string): Observable<BranchApiRecord> {
    const headers = new HttpHeaders({ 'Idempotency-Key': idempotencyKey });
    return this.api.post<BranchApiRecord, typeof payload>('/branches', payload, { headers });
  }

  updateBranch(id: string, payload: {
    name: string;
    address: string;
    phone?: string;
  }): Observable<BranchApiRecord> {
    return this.api.patch<BranchApiRecord, typeof payload>(
      '/branches/' + encodeURIComponent(id), payload,
    );
  }

  activateBranch(id: string, idempotencyKey: string): Observable<BranchApiRecord> {
    const headers = new HttpHeaders({ 'Idempotency-Key': idempotencyKey });
    return this.api.post<BranchApiRecord, Record<string, never>>(
      '/branches/' + encodeURIComponent(id) + '/activate',
      {},
      { headers },
    );
  }

  deactivateBranch(id: string, reason: string, idempotencyKey: string): Observable<BranchApiRecord> {
    const headers = new HttpHeaders({ 'Idempotency-Key': idempotencyKey });
    return this.api.post<BranchApiRecord, { reason: string }>(
      '/branches/' + encodeURIComponent(id) + '/deactivate',
      { reason },
      { headers },
    );
  }

  /** Occupancy/availability for one service at a branch/day. */
  getServiceOccupancy(
    branchId: string, serviceId: string, date: string,
  ): Observable<ServiceAvailabilityResponse> {
    const params = new HttpParams().set('date', date);
    return this.api.get<ServiceAvailabilityResponse>(
      '/branches/' + encodeURIComponent(branchId) +
      '/services/' + encodeURIComponent(serviceId) + '/occupancy',
      { params },
    );
  }

  getInventorySummary(branchId: string): Observable<BranchInventorySummary> {
    return this.api.get<BranchInventorySummary>('/inventory/summary/' + encodeURIComponent(branchId));
  }

  getOperationSlots(branchId: string, date: string): Observable<BranchOperationSlotsResponse> {
    const params = new HttpParams().set('date', date).set('includeFull', 'true');
    return this.api.get<BranchOperationSlotsResponse>(
      '/branches/' + encodeURIComponent(branchId) + '/operation-slots',
      { params },
    );
  }

  listServiceConfigs(branchId: string): Observable<BranchServiceApiRecord[]> {
    return this.getAllPages<BranchServiceApiRecord>(
      '/branches/' + encodeURIComponent(branchId) + '/service-configs',
    );
  }

  updateServiceConfig(
    branchId: string,
    serviceId: string,
    payload: Pick<BranchServiceApiRecord, 'enabled' | 'capacity' | 'availability'>,
  ): Observable<BranchServiceApiRecord> {
    return this.api.put<BranchServiceApiRecord, typeof payload>(
      '/branches/' + encodeURIComponent(branchId) +
      '/service-configs/' + encodeURIComponent(serviceId),
      payload,
    );
  }

  listBlockedWindows(branchId: string, serviceId: string): Observable<BranchServiceBlockedWindow[]> {
    return this.api.get<BranchServiceBlockedWindowsResponse>(
      '/branches/' + encodeURIComponent(branchId) +
      '/service-configs/' + encodeURIComponent(serviceId) + '/blocks',
    ).pipe(map(response => response.blockedWindows ?? []));
  }

  createBlockedWindow(
    branchId: string,
    serviceId: string,
    payload: { startAt: string; endAt: string; reason: string },
  ): Observable<BranchServiceBlockedWindow> {
    return this.api.post<BranchServiceBlockedWindow, typeof payload>(
      '/branches/' + encodeURIComponent(branchId) +
      '/service-configs/' + encodeURIComponent(serviceId) + '/blocks',
      payload,
    );
  }

  deleteBlockedWindow(branchId: string, serviceId: string, blockId: string): Observable<unknown> {
    return this.api.delete(
      '/branches/' + encodeURIComponent(branchId) +
      '/service-configs/' + encodeURIComponent(serviceId) +
      '/blocks/' + encodeURIComponent(blockId),
    );
  }

  /** GET /services supports page/limit/branchId from Backend v7. */
  listBranchServices(branchId: string): Observable<BranchServiceView[]> {
    const pageSize = 100;
    const query = (page: number) => this.catalog.list({
      page, pageSize, branchId, search: '', mode: 'ALL', status: 'ALL',
    });
    const allServices = query(1).pipe(
      expand((res) => res.page * res.pageSize < res.total
        ? query(res.page + 1)
        : EMPTY),
      reduce((all, res) => [...all, ...res.items], [] as CatalogService[]),
    );
    return forkJoin({
      services: allServices,
      configs: this.listServiceConfigs(branchId),
    }).pipe(map(({ services, configs }) => {
      const configsById = new Map(configs.map((config) => [config.serviceId, config]));
      return services.map((service) => {
        const config = configsById.get(service.id) ?? null;
        return {
          service: {
            ...service,
            branchServices: config
              ? [{ branchId, capacity: config.capacity, enabled: config.enabled, availability: 'BY_SHIFT' as const }]
              : [],
          },
          config,
        };
      });
    }));
  }
}

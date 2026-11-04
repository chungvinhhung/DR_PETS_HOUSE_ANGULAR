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
 * The live BE /availability currently only populates start/end/remaining.
 * bookedCount and totalCount are REQUIRED additions to the API contract
 * before the admin UI can display the requested "booked / total" ratio.
 * Never calculate totalCount from configured concurrent capacity: staff
 * availability and sequential segments may reduce real bookable places.
 */
export interface ServiceAvailabilitySlot {
  start: string;
  end: string;
  remaining: number;
  bookedCount?: number;
  totalCount?: number;
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
    status: 'ACTIVE' | 'INACTIVE';
  }): Observable<BranchApiRecord> {
    return this.api.patch<BranchApiRecord, typeof payload>(
      '/branches/' + encodeURIComponent(id), payload,
    );
  }

  /** Data for one service and a chosen branch/day; not the configured capacity. */
  getServiceAvailability(
    branchId: string, serviceId: string, date: string,
  ): Observable<ServiceAvailabilityResponse> {
    const params = new HttpParams()
      .set('branchId', branchId)
      .set('serviceIds', serviceId)
      .set('date', date);
    return this.api.get<ServiceAvailabilityResponse>('/availability', { params });
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

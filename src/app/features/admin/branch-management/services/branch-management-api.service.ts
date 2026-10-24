import { HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EMPTY, expand, forkJoin, map, Observable, reduce } from 'rxjs';

import { ApiClientService } from '../../../../core/services/api-client.service';
import { CatalogService, ServiceBranchConfigsResponse } from '../../service-catalog/models/service-catalog.model';
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
  heldCount?: number;
  status?: 'AVAILABLE' | 'FULL' | 'BLOCKED';
}
export interface ServiceAvailabilityResponse {
  branchId: string;
  serviceIds: readonly string[];
  date: string;
  slots: readonly ServiceAvailabilitySlot[];
}

export interface ServiceTemporaryBlock {
  id: string;
  startAt: string;
  endAt: string;
  reason: string;
  createdAt?: string;
}
export interface ServiceTemporaryBlocksResponse {
  branchId: string;
  serviceId: string;
  blockedWindows: ServiceTemporaryBlock[];
}
export interface BranchOperationSlotsResponse {
  branchId: string;
  date: string;
  servicesCount: number;
  servicesAvailability: ServiceAvailabilityResponse[];
}
export interface BranchInventorySummary {
  branchId: string;
  totalItems: number;
  lowStockItems: number;
  outOfStockItems: number;
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
      .set('date', date)
      .set('includeFull', 'true');
    return this.api.get<ServiceAvailabilityResponse>('/availability', { params });
  }

  getServiceOccupancy(
    branchId: string, serviceId: string, date: string,
  ): Observable<ServiceAvailabilityResponse> {
    return this.api.get<ServiceAvailabilityResponse>(
      '/branches/' + encodeURIComponent(branchId) + '/services/' +
      encodeURIComponent(serviceId) + '/occupancy',
      { params: new HttpParams().set('date', date) },
    );
  }

  getOperationSlots(branchId: string, date: string): Observable<BranchOperationSlotsResponse> {
    return this.api.get<BranchOperationSlotsResponse>(
      '/branches/' + encodeURIComponent(branchId) + '/operation-slots',
      { params: new HttpParams().set('date', date) },
    );
  }

  getInventorySummary(branchId: string): Observable<BranchInventorySummary> {
    return this.api.get<BranchInventorySummary>(
      '/branches/' + encodeURIComponent(branchId) + '/inventory-summary',
    );
  }

  /** BE v7 uses /blocks, not /temporary-blocks from the draft handoff. */
  listTemporaryBlocks(branchId: string, serviceId: string): Observable<ServiceTemporaryBlocksResponse> {
    return this.api.get<ServiceTemporaryBlocksResponse>(this.blocksPath(branchId, serviceId));
  }

  createTemporaryBlock(
    branchId: string, serviceId: string,
    payload: { startAt: string; endAt: string; reason: string },
  ): Observable<ServiceTemporaryBlock> {
    return this.api.post<ServiceTemporaryBlock, typeof payload>(
      this.blocksPath(branchId, serviceId), payload,
    );
  }

  deleteTemporaryBlock(branchId: string, serviceId: string, blockId: string): Observable<unknown> {
    return this.api.delete<unknown>(
      this.blocksPath(branchId, serviceId) + '/' + encodeURIComponent(blockId),
    );
  }

  private blocksPath(branchId: string, serviceId: string): string {
    return '/branches/' + encodeURIComponent(branchId) + '/service-configs/' +
      encodeURIComponent(serviceId) + '/blocks';
  }

  listServiceBranchConfigs(serviceId: string): Observable<ServiceBranchConfigsResponse> {
    return this.catalog.getBranchConfigs(serviceId);
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

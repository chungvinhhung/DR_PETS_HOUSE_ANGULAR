import { HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { EMPTY, expand, forkJoin, map, Observable, reduce } from 'rxjs';

import { ApiClientService } from '../../../../core/services/api-client.service';
import {
  CatalogService, ServiceApiRecord,
} from '../../service-catalog/models/service-catalog.model';
import {
  ServiceCatalogApiService, serviceFromApi,
} from '../../service-catalog/services/service-catalog-api.service';

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

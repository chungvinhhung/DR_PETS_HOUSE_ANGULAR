import { HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { ApiClientService } from '../../../../core/services/api-client.service';
import {
  CatalogBranch, CatalogListQuery, CatalogListResult, CatalogService,
  ServiceBookingMode, ServiceMasterStatus,
} from '../models/service-catalog.model';

/** Task 3.7 contract: BE feat/foundation-v6, docs/Task-2.8-v7-confirmed/07-openapi-v7.yaml */
export interface ServicePriceVariant {
  label: string;
  minWeightKg?: number;
  maxWeightKg?: number;
  price: number;
}
export interface ServiceMaterial {
  materialId: string;
  defaultQuantity: number;
  unit: string;
}
export interface ServiceDetail {
  id: string;
  code?: string;
  name: string;
  serviceType: 'GROOMING' | 'MEDICAL';
  category?: string;
  description?: string;
  basePrice: number;
  priceVariants?: ServicePriceVariant[];
  durationMinutes: number;
  requiredStaffRole: 'CARE_STAFF_GROOMER' | 'NURSE' | 'VETERINARIAN';
  bookingMode: ServiceBookingMode;
  defaultMaterials?: ServiceMaterial[];
  status: ServiceMasterStatus;
  enabledBranchCount?: number;
  totalBranchCount?: number;
  isAvailable?: boolean;
  availabilityText?: string;
  branchConfig?: { enabled: boolean; capacity: number };
}

export type ServiceWrite = Pick<ServiceDetail,
  'name' | 'serviceType' | 'basePrice' | 'durationMinutes' | 'requiredStaffRole' | 'bookingMode'
> & Partial<Pick<ServiceDetail,
  'category' | 'description' | 'priceVariants' | 'status' | 'defaultMaterials'>>;

interface ApiServicePage {
  items: ServiceDetail[];
  totalItems?: number;
  total?: number;
}
interface ApiBranchPage {
  items: Array<{ id: string; name: string }>;
  nextCursor?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ServiceCatalogApiService {
  private readonly api = inject(ApiClientService);

  list(query: CatalogListQuery): Observable<CatalogListResult> {
    let params = new HttpParams()
      .set('page', String(query.page))
      .set('limit', String(query.pageSize));
    if (query.search.trim()) params = params.set('search', query.search.trim());
    if (query.mode !== 'ALL') params = params.set('bookingMode', query.mode);
    if (query.status !== 'ALL') params = params.set('status', query.status);
    if (query.branchId !== 'ALL') params = params.set('branchId', query.branchId);
    return this.api.get<ApiServicePage>('/services', { params }).pipe(
      map((response) => ({
        items: response.items.map((item) => this.toCatalogRow(item)),
        total: response.totalItems ?? response.total ?? response.items.length,
        page: query.page,
        pageSize: query.pageSize,
      })),
    );
  }

  listBranches(): Observable<CatalogBranch[]> {
    // Branch list is read-only here. BranchService settings remain in the Branch task.
    return this.api.get<ApiBranchPage>('/branches', {
      params: new HttpParams().set('limit', '100'),
    }).pipe(map((page) => page.items.map((b) => ({ id: b.id, name: b.name }))));
  }

  get(id: string): Observable<ServiceDetail> {
    return this.api.get<ServiceDetail>('/services/' + encodeURIComponent(id));
  }

  create(body: ServiceWrite, key: string): Observable<ServiceDetail> {
    return this.api.post<ServiceDetail, ServiceWrite>('/services', body, {
      headers: new HttpHeaders({ 'Idempotency-Key': key }),
    });
  }

  update(id: string, body: ServiceWrite): Observable<ServiceDetail> {
    return this.api.patch<ServiceDetail, ServiceWrite>(
      '/services/' + encodeURIComponent(id), body,
    );
  }

  private toCatalogRow(item: ServiceDetail): CatalogService {
    const prices = (item.priceVariants ?? []).map((variant) => variant.price)
      .filter((value) => Number.isFinite(value) && value > 0);
    return {
      id: item.id,
      serviceCode: item.code || '—',
      name: item.name,
      category: item.category || item.serviceType,
      executorRole: item.requiredStaffRole,
      bookingMode: item.bookingMode,
      durationMinutes: Number.isFinite(item.durationMinutes) ? item.durationMinutes : null,
      status: item.status,
      referencePrice: item.basePrice,
      minFixedTierPrice: prices.length ? Math.min(...prices) : null,
      branchServices: [],
      enabledBranchCount: item.enabledBranchCount,
      totalBranchCount: item.totalBranchCount,
      branchEnabled: item.branchConfig?.enabled,
      availabilityText: item.availabilityText,
      isAvailable: item.isAvailable,
    };
  }
}

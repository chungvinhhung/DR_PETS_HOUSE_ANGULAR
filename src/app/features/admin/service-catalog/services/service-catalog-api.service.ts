import { HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { ApiClientService } from '../../../../core/services/api-client.service';
import { resolveServicePricing } from './service-pricing.utils';
import {
  CatalogBranch, CatalogListQuery, CatalogListResult, CatalogService,
  ServiceApiRecord, ServiceWrite,
} from '../models/service-catalog.model';

interface ServiceApiPage {
  items: ServiceApiRecord[];
  total?: number;
  totalItems?: number;
  page?: number;
  limit?: number;
}
interface BranchApiPage {
  items: { id: string; name: string; status?: string }[];
  nextCursor?: string | null;
}
interface BranchApiEnvelope { data?: BranchApiPage; items?: BranchApiPage['items']; nextCursor?: string | null; }

export function serviceFromApi(raw: ServiceApiRecord, branchId = 'ALL'): CatalogService {
  const pricing = resolveServicePricing(raw);
  const fixed = [...pricing.fixedTiers.values()];
  const branch = raw.branchConfig && branchId !== 'ALL' ? [{
    branchId, capacity: raw.branchConfig.capacity, enabled: raw.branchConfig.enabled,
    availability: 'BY_SHIFT' as const,
  }] : [];
  return {
    id: raw.id,
    serviceCode: raw.code ?? '',
    name: raw.name,
    category: raw.serviceType,
    executorRole: raw.requiredStaffRole,
    bookingMode: raw.bookingMode,
    durationMinutes: raw.durationMinutes,
    status: raw.status,
    // Only surface amounts the edit form can actually represent.
    // Explicit empty priceVariants + positive basePrice is ambiguous, not a confirmed fee.
    referencePrice: pricing.confirmedBasePrice,
    minFixedTierPrice: fixed.length ? Math.min(...fixed) : null,
    pricingDataWarning: pricing.hasUnmappedPricing,
    branchServices: branch,
    enabledBranchCount: raw.enabledBranchCount,
    totalBranchCount: raw.totalBranchCount,
    availabilityText: raw.availabilityText,
    isAvailable: raw.isAvailable,
    description: raw.description ?? '',
    basePrice: raw.basePrice,
    priceVariants: raw.priceVariants ?? [],
    defaultMaterials: raw.defaultMaterials ?? [],
    contactInfo: raw.contactInfo,
  };
}

@Injectable({ providedIn: 'root' })
export class ServiceCatalogApiService {
  private readonly api = inject(ApiClientService);

  list(query: CatalogListQuery): Observable<CatalogListResult> {
    let params = new HttpParams()
      .set('page', String(query.page))
      .set('limit', String(query.pageSize));
    if (query.search.trim()) params = params.set('search', query.search.trim());
    if (query.branchId !== 'ALL') params = params.set('branchId', query.branchId);
    if (query.mode !== 'ALL') params = params.set('bookingMode', query.mode);
    if (query.status !== 'ALL') params = params.set('status', query.status);
    return this.api.get<ServiceApiPage>('/services', { params }).pipe(
      map((res) => ({
        items: res.items.map((record) => serviceFromApi(record, query.branchId)),
        total: res.totalItems ?? res.total ?? res.items.length,
        page: res.page ?? query.page,
        pageSize: res.limit ?? query.pageSize,
      })),
    );
  }

  get(id: string): Observable<ServiceApiRecord> {
    return this.api.get<ServiceApiRecord>('/services/' + encodeURIComponent(id));
  }

  create(body: ServiceWrite, idempotencyKey: string): Observable<ServiceApiRecord> {
    const headers = new HttpHeaders({ 'Idempotency-Key': idempotencyKey });
    return this.api.post<ServiceApiRecord, ServiceWrite>('/services', body, { headers });
  }

  update(id: string, body: Partial<ServiceWrite>): Observable<ServiceApiRecord> {
    return this.api.patch<ServiceApiRecord, Partial<ServiceWrite>>(
      '/services/' + encodeURIComponent(id), body,
    );
  }

  archive(id: string, idempotencyKey: string): Observable<ServiceApiRecord> {
    const headers = new HttpHeaders({ 'Idempotency-Key': idempotencyKey });
    return this.api.post<ServiceApiRecord, Record<string, never>>(
      '/services/' + encodeURIComponent(id) + '/archive',
      {},
      { headers },
    );
  }

  /** All accessible branches for Service Detail, including inactive branches.
   * A service can be unavailable at a branch without the branch disappearing
   * from the read-only detail card. Backend remains the authority on scope. */
  listBranchesForServiceDetail(): Observable<CatalogBranch[]> {
    return this.api.get<BranchApiEnvelope>('/branches', {
      params: new HttpParams().set('limit', '100'),
    }).pipe(map((value) => {
      const page = value.data ?? value;
      return (page.items ?? []).map((branch) => ({
        id: branch.id,
        name: branch.name,
      }));
    }));
  }

  /** Read-only dropdown options; no BranchService config write is performed here. */
  listBranches(): Observable<CatalogBranch[]> {
    return this.api.get<BranchApiEnvelope>('/branches', {
      params: new HttpParams().set('limit', '100'),
    }).pipe(map((value) => {
      const page = value.data ?? value;
      return (page.items ?? [])
        .filter((b) => b.status === undefined || b.status === 'ACTIVE')
        .map((b) => ({ id: b.id, name: b.name }));
    }));
  }
}

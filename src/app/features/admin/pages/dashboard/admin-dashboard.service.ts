import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiClientService } from '../../../../core/services/api-client.service';

/** Calendar dates (inclusive) according to Asia/Ho_Chi_Minh. */
export interface DashboardFilters {
  from: string;
  to: string;
  branchId: string | null;
}
export type DashboardGranularity = 'hour' | 'day' | 'week' | 'month';
export interface DashboardRange {
  from: string;
  to: string;
  previousFrom?: string;
  previousTo?: string;
  granularity?: DashboardGranularity;
  timezone: 'Asia/Ho_Chi_Minh';
  branchIds: string[];
}
export interface DashboardKpiPoint {
  periodStart: string;
  value: number;
}
export interface DashboardKpiMetric {
  current: number;
  previous: number;
  delta: number;
  changePercent: number | null;
  currency?: 'VND';
  trend: DashboardKpiPoint[];
}
export interface DashboardStatusCatalogItem {
  code: string;
  label: string;
  tone: string;
  group: string;
}
export interface DashboardSummary {
  range: DashboardRange;
  kpis: {
    revenue: DashboardKpiMetric;
    orders: DashboardKpiMetric;
    appointments: DashboardKpiMetric;
    activeCustomers: DashboardKpiMetric;
  };
  orderCountsByStatus: Record<string, number>;
  appointmentCountsByStatus: Record<string, number>;
  statusCatalog: {
    order: DashboardStatusCatalogItem[];
    appointment: DashboardStatusCatalogItem[];
    payment: { code: string; label: string; scope: string }[];
  };
  // Legacy keys retained by BE. Use kpis for all presentation values.
  orders: number;
  appointments: number;
  revenue: { amount: number; currency: 'VND' };
  newCustomers: number;
  lowStockItems: number;
  breakdown: {
    commerceRevenue: number;
    clinicRevenue: number;
    orderRevenue: number;
    serviceRevenue: number;
    refundAdjustment: number;
    orderCountsByStatus: Record<string, number>;
    appointmentCountsByStatus: Record<string, number>;
    timeRange?: { startDate: string; endDate: string };
  };
}
export interface DashboardRevenuePoint {
  periodStart: string;
  orderRevenue: number;
  serviceRevenue: number;
  refundAdjustment: number; // Can make net revenue negative.
  totalRevenue: number;
}
export interface DashboardRevenueAnalytics {
  currency: 'VND';
  granularity: DashboardGranularity;
  range: DashboardRange;
  totalRevenue: number;
  previousRevenue: number;
  delta: number;
  changePercent: number | null;
  totals: {
    orderRevenue: number;
    serviceRevenue: number;
    refundAdjustment: number;
  };
  points: DashboardRevenuePoint[];
}
export interface DashboardLowStockItem {
  stockId: string;
  inventoryItemId: string;
  branchId: string;
  branchName: string;
  branchCode: string | null;
  sku: string;
  name: string;
  unit: string;
  kind: 'PRODUCT' | 'MATERIAL';
  imageUrl: string | null;
  quantity: number;
  lowStockThreshold: number;
  threshold: number;
  thresholdConfigured: boolean;
  status: 'OUT_OF_STOCK' | 'LOW_STOCK';
}
export interface DashboardLowStock {
  total: number;
  unconfiguredCount: number;
  items: DashboardLowStockItem[];
}
export interface DashboardServiceStat {
  serviceId: string | null;
  name: string;
  serviceType: string;
  completedCount: number;
  revenue: null;
}
export interface DashboardServiceStats {
  range: DashboardRange;
  items: DashboardServiceStat[];
}
export interface DashboardAttentionOrder {
  id: string;
  code: string;
  customerName: string;
  totalAmount: number;
  createdAt: string | null;
  status: string;
  branchId: string | null;
  branchName: string | null;
}
export interface DashboardAttentionAppointment {
  id: string;
  code: string;
  customerName: string;
  petName: string | null;
  scheduledStart: string | null;
  status: string;
  serviceType: string;
  branchId: string | null;
  branchName: string | null;
}
export interface DashboardAttention {
  branchIds: string[];
  ordersTotal: number;
  appointmentsTotal: number;
  orders: DashboardAttentionOrder[];
  appointments: DashboardAttentionAppointment[];
}

/** BE returns {success:true,data}; accept unwrapped API results for compatibility. */
function unwrap<T>(response: unknown): T {
  const object = response as { data?: T; DT?: T } | null;
  return (object?.data ?? object?.DT ?? response) as T;
}

@Injectable({ providedIn: 'root' })
export class AdminDashboardService {
  private readonly api = inject(ApiClientService);

  private periodParams(filters: DashboardFilters): HttpParams {
    let params = new HttpParams()
      .set('from', filters.from)
      .set('to', filters.to)
      .set('timezone', 'Asia/Ho_Chi_Minh');
    if (filters.branchId) params = params.set('branchId', filters.branchId);
    return params;
  }
  private operationalParams(branchId: string | null, limit: number): HttpParams {
    let params = new HttpParams().set('limit', String(limit));
    if (branchId) params = params.set('branchId', branchId);
    return params;
  }

  summary(filters: DashboardFilters): Observable<DashboardSummary> {
    return this.api.get<unknown>('/dashboard/summary', { params: this.periodParams(filters) })
      .pipe(map(unwrap<DashboardSummary>));
  }
  revenue(filters: DashboardFilters): Observable<DashboardRevenueAnalytics> {
    return this.api.get<unknown>('/dashboard/revenue-analytics', { params: this.periodParams(filters) })
      .pipe(map(unwrap<DashboardRevenueAnalytics>));
  }
  lowStock(branchId: string | null, limit = 5): Observable<DashboardLowStock> {
    return this.api.get<unknown>('/dashboard/low-stock', {
      params: this.operationalParams(branchId, limit),
    }).pipe(map(unwrap<DashboardLowStock>));
  }
  serviceStats(filters: DashboardFilters, limit = 5): Observable<DashboardServiceStats> {
    return this.api.get<unknown>('/dashboard/service-stats', {
      params: this.periodParams(filters).set('limit', String(limit)),
    }).pipe(map(unwrap<DashboardServiceStats>));
  }
  /** /attention deliberately ignores from/to/preset and reports current operations. */
  attention(branchId: string | null, limit = 5): Observable<DashboardAttention> {
    return this.api.get<unknown>('/dashboard/attention', {
      params: this.operationalParams(branchId, limit).set('includeShipped', 'false'),
    }).pipe(map(unwrap<DashboardAttention>));
  }
}

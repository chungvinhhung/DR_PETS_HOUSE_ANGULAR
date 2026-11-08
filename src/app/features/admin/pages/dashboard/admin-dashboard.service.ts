import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiClientService } from '../../../../core/services/api-client.service';

/** Calendar dates in Asia/Ho_Chi_Minh, both endpoints inclusive. */
export interface DashboardFilters {
  from: string;
  to: string;
  branchId: string | null;
}

export interface DashboardSummary {
  orders: number;
  appointments: number;
  revenue: { amount: number; currency: string };
  newCustomers: number;
  lowStockItems: number;
  breakdown?: {
    commerceRevenue?: number;
    clinicRevenue?: number;
    orderCountsByStatus?: Record<string, number>;
    appointmentCountsByStatus?: Record<string, number>;
    timeRange?: { startDate?: string; endDate?: string };
  };
}

export interface DashboardRevenuePoint { date: string; orders: number; revenue: number }
export interface DashboardLowStock {
  stockId: string;
  quantity: number;
  branch?: { id?: string; name?: string; code?: string };
  item?: { id?: string; sku?: string; name?: string; barcode?: string };
}
export interface DashboardServiceStat {
  serviceId: string;
  name: string;
  bookingsCount: number;
  estimatedRevenue: number;
}
function unwrap<T>(response: any): T {
  return (response?.DT ?? response?.data ?? response) as T;
}

@Injectable({ providedIn: 'root' })
export class AdminDashboardService {
  private readonly api = inject(ApiClientService);

  private params(filters: DashboardFilters): HttpParams {
    let params = new HttpParams().set('from', filters.from).set('to', filters.to);
    if (filters.branchId) params = params.set('branchId', filters.branchId);
    return params;
  }

  /** Confirmed foundation-v6 API. Note: only its Order count/status currently meet M23 definitions. */
  summary(filters: DashboardFilters): Observable<DashboardSummary> {
    return this.api.get<any>('/dashboard/summary', { params: this.params(filters) })
      .pipe(map(unwrap<DashboardSummary>));
  }

  /** Legacy endpoints retained for future contract migration, not used as M23 revenue/service KPIs. */
  revenue(filters: DashboardFilters): Observable<DashboardRevenuePoint[]> {
    return this.api.get<any>('/dashboard/revenue-analytics', { params: this.params(filters) })
      .pipe(map(unwrap<DashboardRevenuePoint[]>));
  }
  lowStock(branchId: string | null): Observable<DashboardLowStock[]> {
    let params = new HttpParams();
    if (branchId) params = params.set('branchId', branchId);
    return this.api.get<any>('/dashboard/low-stock', { params })
      .pipe(map(unwrap<DashboardLowStock[]>));
  }
  serviceStats(filters: DashboardFilters): Observable<DashboardServiceStat[]> {
    return this.api.get<any>('/dashboard/service-stats', { params: this.params(filters) })
      .pipe(map(unwrap<DashboardServiceStat[]>));
  }
}

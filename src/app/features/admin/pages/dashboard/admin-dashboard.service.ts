import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiClientService } from '../../../../core/services/api-client.service';

export interface DashboardSummary {
  orders:number;
  appointments:number;
  revenue:{amount:number;currency:string};
  newCustomers:number;
  lowStockItems:number;
  breakdown?:{
    commerceRevenue?:number;
    clinicRevenue?:number;
    timeRange?:{startDate?:string;endDate?:string};
  };
}
export interface DashboardRevenuePoint {date:string;orders:number;revenue:number}
export interface DashboardLowStock {
  stockId:string;quantity:number;
  branch?:{id?:string;name?:string;code?:string};
  item?:{id?:string;sku?:string;name?:string;barcode?:string};
}
export interface DashboardServiceStat {
  serviceId:string;name:string;bookingsCount:number;estimatedRevenue:number;
}
function unwrap<T>(response:any):T {
  return (response?.DT ?? response?.data ?? response) as T;
}

@Injectable({providedIn:'root'})
export class AdminDashboardService {
  private readonly api=inject(ApiClientService);

  summary(preset:string):Observable<DashboardSummary> {
    return this.api.get<any>('/dashboard/summary',{params:new HttpParams().set('preset',preset)})
      .pipe(map(unwrap<DashboardSummary>));
  }
  revenue(preset:string):Observable<DashboardRevenuePoint[]> {
    return this.api.get<any>('/dashboard/revenue-analytics',{params:new HttpParams().set('preset',preset)})
      .pipe(map(unwrap<DashboardRevenuePoint[]>));
  }
  lowStock():Observable<DashboardLowStock[]> {
    return this.api.get<any>('/dashboard/low-stock')
      .pipe(map(unwrap<DashboardLowStock[]>));
  }
  serviceStats(preset:string):Observable<DashboardServiceStat[]> {
    return this.api.get<any>('/dashboard/service-stats',{params:new HttpParams().set('preset',preset)})
      .pipe(map(unwrap<DashboardServiceStat[]>));
  }
}

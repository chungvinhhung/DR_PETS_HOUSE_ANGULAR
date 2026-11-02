import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable, forkJoin, map } from 'rxjs';

import { ApiClientService } from '../../../../core/services/api-client.service';

export interface AdminCustomer {
  id: string;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  activationStatus: 'NO_ACCOUNT' | 'PENDING_ACTIVATION' | 'ACTIVATED' | string;
  accountStatus?: 'ACTIVE' | 'BLOCKED' | null | string;
  lastLogin?: string | null;
  createdAt?: string | null;
  blockedReason?: string | null;
}

export interface CustomerListResponse {
  items: AdminCustomer[];
  nextCursor: string | null;
}

@Injectable({ providedIn: 'root' })
export class AdminCustomerService {
  private readonly api = inject(ApiClientService);

  listCustomers(): Observable<AdminCustomer[]> {
    return this.api.get<CustomerListResponse>('/admin/customers', {
      params: new HttpParams().set('limit', '100'),
    }).pipe(map(response => response.items ?? []));
  }

  getCustomer(id: string): Observable<AdminCustomer> {
    return this.api.get<AdminCustomer>('/admin/customers/' + encodeURIComponent(id));
  }

  getPets(id: string): Observable<any[]> {
    return this.api.get<any[]>('/admin/customers/' + encodeURIComponent(id) + '/pets');
  }

  getOrders(id: string): Observable<any[]> {
    return this.api.get<any>('/orders', {
      params: new HttpParams().set('customerId', id).set('limit', '100'),
    }).pipe(map(response => response?.items ?? []));
  }

  getAppointments(id: string): Observable<any[]> {
    return this.api.get<any>('/appointments', {
      params: new HttpParams().set('customerId', id).set('limit', '100'),
    }).pipe(map(response => response?.items ?? []));
  }

  getFeedback(id: string): Observable<any[]> {
    return this.api.get<any>('/feedback', {
      params: new HttpParams().set('limit', '100'),
    }).pipe(map(response =>
      (response?.items ?? []).filter((item: any) =>
        String(item.customerId?._id ?? item.customerId ?? '') === id)));
  }

  loadCustomerDetail(id: string) {
    return forkJoin({
      customer: this.getCustomer(id),
      pets: this.getPets(id),
      orders: this.getOrders(id),
      appointments: this.getAppointments(id),
      feedback: this.getFeedback(id),
    });
  }

  block(id: string, reason: string): Observable<AdminCustomer> {
    return this.api.post<AdminCustomer, { reason: string }>(
      '/admin/customers/' + encodeURIComponent(id) + '/block',
      { reason },
    );
  }

  unblock(id: string, reason: string): Observable<AdminCustomer> {
    return this.api.post<AdminCustomer, { reason: string }>(
      '/admin/customers/' + encodeURIComponent(id) + '/unblock',
      { reason },
    );
  }
}

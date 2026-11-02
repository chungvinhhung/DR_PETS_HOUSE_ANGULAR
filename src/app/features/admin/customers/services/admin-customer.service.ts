import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';

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

  getOrders(customer: AdminCustomer): Observable<any[]> {
    let params = new HttpParams().set('limit', '100');
    // Order.customerId currently stores User id while Customer API deliberately
    // hides userId. Use the verified contact snapshot for reconciliation instead
    // of incorrectly querying by Customer document id.
    if (customer.phone) params = params.set('search', customer.phone);
    else if (customer.fullName) params = params.set('search', customer.fullName);
    return this.api.get<any>('/orders', { params }).pipe(map(response => response?.items ?? []));
  }

  getAppointments(customer: AdminCustomer): Observable<any[]> {
    return this.api.get<any>('/appointments', {
      params: new HttpParams().set('limit', '100'),
    }).pipe(map(response => {
      const items = response?.items ?? [];
      const phone = String(customer.phone ?? '').trim();
      const email = String(customer.email ?? '').trim().toLowerCase();
      const name = String(customer.fullName ?? '').trim().toLocaleLowerCase('vi');
      return items.filter((item: any) => {
        const snapshot = item.customerSnapshot ?? item.contactSnapshot ?? {};
        const itemPhone = String(snapshot.phone ?? '').trim();
        const itemEmail = String(snapshot.email ?? '').trim().toLowerCase();
        const itemName = String(snapshot.fullName ?? snapshot.name ?? '').trim().toLocaleLowerCase('vi');
        return (phone && itemPhone === phone) || (email && itemEmail === email) || (name && itemName === name);
      });
    }));
  }

  getFeedback(id: string): Observable<any[]> {
    return this.api.get<any>('/feedback', {
      params: new HttpParams().set('limit', '100'),
    }).pipe(map(response =>
      (response?.items ?? []).filter((item: any) =>
        String(item.customerId?._id ?? item.customerId ?? '') === id)));
  }

  loadCustomerDetail(id: string) {
    return this.getCustomer(id).pipe(
      switchMap(customer => forkJoin({
        customer: of(customer),
        pets: this.getPets(id),
        orders: this.getOrders(customer),
        appointments: this.getAppointments(customer),
        feedback: this.getFeedback(id),
      })),
    );
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

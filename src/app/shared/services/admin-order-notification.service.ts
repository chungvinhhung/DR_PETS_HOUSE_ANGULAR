import { Injectable, inject, signal } from '@angular/core';
import { Observable, finalize, shareReplay, tap, throwError } from 'rxjs';

import { AuthSessionService } from '../../core/services/auth-session.service';
import {
  AdminOrderApiService, OrderListResponse,
} from '../../features/admin/orders/services/admin-order-api.service';

/**
 * Shared source for PENDING Order badges on the Sales sidebar and Order tab.
 * Shares an in-flight list request with the management page, so opening
 * that page does not request the same list twice.
 */
@Injectable({ providedIn: 'root' })
export class AdminOrderNotificationService {
  private readonly api = inject(AdminOrderApiService);
  private readonly session = inject(AuthSessionService);
  private readonly pendingCountState = signal(0);
  private readonly loadedState = signal(false);
  private accountId: string | null = null;
  private requestVersion = 0;
  private inFlight: Observable<OrderListResponse> | null = null;

  readonly pendingCount = this.pendingCountState.asReadonly();
  readonly loaded = this.loadedState.asReadonly();

  private syncAccount(): boolean {
    const account = this.session.user();
    const id = account?.id ?? null;
    if (id !== this.accountId) {
      this.accountId = id;
      this.requestVersion++;
      this.inFlight = null;
      this.pendingCountState.set(0);
      this.loadedState.set(false);
    }
    return Boolean(account && (
      account.systemRole === 'ADMIN' || account.systemRole === 'MANAGER' ||
      (account.systemRole === 'STAFF' && account.staffSubRole === 'RECEPTIONIST')
    ));
  }

  ensureLoaded(): void {
    if (!this.syncAccount() || this.loadedState() || this.inFlight) return;
    this.listForView().subscribe({ error: () => { /* Keep badge hidden until data loads. */ } });
  }

  listForView(force = false): Observable<OrderListResponse> {
    if (!this.syncAccount()) {
      return throwError(() => new Error('Bạn không có quyền xem danh sách đơn hàng.'));
    }
    if (!force && this.inFlight) return this.inFlight;
    const accountId = this.accountId;
    const version = ++this.requestVersion;
    let request: Observable<OrderListResponse>;
    request = this.api.list().pipe(
      tap(page => {
        if (this.accountId !== accountId || this.requestVersion !== version) return;
        this.pendingCountState.set(page.items.filter(order => order.status === 'PENDING').length);
        this.loadedState.set(true);
      }),
      finalize(() => { if (this.inFlight === request) this.inFlight = null; }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.inFlight = request;
    return request;
  }

  refresh(): void {
    if (!this.syncAccount()) return;
    this.listForView(true).subscribe({ error: () => { /* Preserve last confirmed count. */ } });
  }
}

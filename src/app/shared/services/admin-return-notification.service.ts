import { Injectable, inject, signal } from '@angular/core';
import { AdminOrderApiService, OrderReturnSummary } from '../../features/admin/orders/services/admin-order-api.service';
import { AuthSessionService } from '../../core/services/auth-session.service';

/**
 * One source of truth for the pending Return badge in Sales, Orders, and
 * the Return/Refund tab. Loaded before the tab is visited.
 *
 * The badge counts REQUESTED requests (awaiting reception), not all returns.
 * A successful workflow mutation triggers a forced refresh.
 */
@Injectable({ providedIn: 'root' })
export class AdminReturnNotificationService {
  private readonly api = inject(AdminOrderApiService);
  private readonly session = inject(AuthSessionService);
  private readonly pendingCountState = signal(0);
  private readonly inFlightState = signal(false);
  private readonly loadedState = signal(false);
  private accountId: string | null = null;
  private requestVersion = 0;

  readonly pendingCount = this.pendingCountState.asReadonly();
  readonly loading = this.inFlightState.asReadonly();
  readonly loaded = this.loadedState.asReadonly();

  ensureLoaded(force = false): void {
    const account = this.session.user();
    const permitted = this.session.hasAnyRole(['ADMIN', 'MANAGER', 'STAFF']);
    if (!account || !permitted) {
      this.accountId = null;
      this.pendingCountState.set(0);
      this.loadedState.set(false);
      return;
    }
    if (account.id !== this.accountId) {
      this.accountId = account.id;
      this.pendingCountState.set(0);
      this.loadedState.set(false);
    }
    if (!force && (this.loadedState() || this.inFlightState())) return;
    const version = ++this.requestVersion;
    const accountId = account.id;
    this.inFlightState.set(true);
    this.api.listReturns().subscribe({
      next: page => {
        if (version !== this.requestVersion || accountId !== this.accountId) return;
        this.updateFromList(page.items);
        this.inFlightState.set(false);
      },
      error: () => {
        if (version !== this.requestVersion || accountId !== this.accountId) return;
        // Keep the last known count rather than silently claiming there are zero.
        this.inFlightState.set(false);
      },
    });
  }

  updateFromList(items: readonly OrderReturnSummary[]): void {
    this.pendingCountState.set(items.filter(item => item.status === 'REQUESTED').length);
    this.loadedState.set(true);
  }

  refresh(): void { this.ensureLoaded(true); }
}

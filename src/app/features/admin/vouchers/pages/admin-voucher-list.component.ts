import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminToastService, adminErrorMessage } from '../../../../shared/services/admin-toast.service';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import {
  AdminVoucher, AdminVoucherApiService, VoucherScope, VoucherStatus, VOUCHER_SCOPE_LABELS,
  voucherAvailability, voucherDate, voucherOffer,
} from '../services/admin-voucher-api.service';

@Component({
  selector: 'app-admin-voucher-list',
  standalone: true,
  imports: [RouterLink, AdminCatalogShellComponent],
  templateUrl: './admin-voucher-list.component.html',
  styleUrl: './admin-voucher-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminVoucherListComponent {
  private readonly api = inject(AdminVoucherApiService);
  private readonly toast = inject(AdminToastService);
  private readonly session = inject(AuthSessionService);
  private readonly destroyRef = inject(DestroyRef);
  private requestVersion = 0;

  readonly all = signal<AdminVoucher[]>([]);
  readonly search = signal('');
  readonly scope = signal<VoucherScope | 'ALL'>('ALL');
  readonly status = signal<VoucherStatus | 'ALL'>('ALL');
  readonly loading = signal(false);
  readonly availabilityFilter = signal('ALL');
  readonly error = signal('');
  readonly cursor = signal<string | null>(null);
  readonly nextCursor = signal<string | null>(null);
  readonly previous = signal<(string | null)[]>([]);
  readonly page = computed(() => this.previous().length + 1);
  // Cursor pagination exposes reachable page numbers, not fabricated total pages.
  readonly visiblePageNumbers = computed(() => {
    const current = this.page();
    const from = Math.max(1, current - 2);
    const end = current + (this.nextCursor() ? 1 : 0);
    return Array.from({ length: end - from + 1 }, (_, i) => from + i);
  });
  readonly canEdit = computed(() => this.session.user()?.systemRole === 'ADMIN');
  readonly hasActiveFilters = computed(() =>
    Boolean(this.search().trim()) || this.scope() !== 'ALL' || this.status() !== 'ALL' ||
    this.availabilityFilter() !== 'ALL' || this.cursor() !== null);
  readonly filtered = computed(() => {
    const q = this.search().trim().toLocaleLowerCase('vi');
    return this.all().filter(item =>
      (this.availabilityFilter() === 'ALL' || voucherAvailability(item) === this.availabilityFilter()) &&
      (!q || [item.code, item.name].some(v => v.toLocaleLowerCase('vi').includes(q))));
  });
  readonly scopeLabels = VOUCHER_SCOPE_LABELS;

  constructor() { this.fetch(); }
  fetch(): void {
    const request = ++this.requestVersion;
    const current = this.cursor();
    const filters = {
      ...(this.scope() !== 'ALL' ? {scope: this.scope() as VoucherScope} : {}),
      ...(this.status() !== 'ALL' ? {status: this.status() as VoucherStatus} : {}),
      ...(current ? {cursor:current} : {}),
    };
    this.loading.set(true);
    this.error.set('');
    this.api.list(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        // A response from an older filter/page selection must never overwrite the latest data.
        if (request !== this.requestVersion) return;
        this.all.set(Array.isArray(result.items) ? result.items : []);
        this.nextCursor.set(result.nextCursor || null);
        this.loading.set(false);
      },
      error: err => {
        // A response from an older filter/page selection must never overwrite the latest data.
        if (request !== this.requestVersion) return;
        this.loading.set(false); this.all.set([]);
        this.nextCursor.set(null);
        this.error.set(adminErrorMessage(err, 'Không tải được danh sách voucher.'));
      },
    });
  }
  setSearch(value: string): void { this.search.set(value); }
  setAvailability(value: string): void { this.availabilityFilter.set(value); }
  setScope(value: string): void {
    if (value !== 'ALL' && !['ORDER','PRODUCT','SERVICE'].includes(value)) return;
    this.scope.set(value as VoucherScope | 'ALL'); this.resetAndFetch();
  }
  setStatus(value: string): void {
    if (value !== 'ALL' && !['ACTIVE','INACTIVE'].includes(value)) return;
    this.status.set(value as VoucherStatus | 'ALL'); this.resetAndFetch();
  }
  resetAndFetch(): void {
    this.previous.set([]);
    this.cursor.set(null);
    this.fetch();
  }
  next(): void {
    if (!this.nextCursor() || this.loading()) return;
    this.previous.update(a => [...a, this.cursor()]);
    this.cursor.set(this.nextCursor());
    this.fetch();
  }
  prev(): void {
    const prev = this.previous();
    if (!prev.length || this.loading()) return;
    this.cursor.set(prev[prev.length - 1]);
    this.previous.set(prev.slice(0,-1));
    this.fetch();
  }
  goToPage(target: number): void {
    if (!Number.isSafeInteger(target) || target < 1 || this.loading()) return;
    if (target === this.page()) return;
    if (target === this.page() + 1) { this.next(); return; }
    if (target > this.previous().length) return;
    const previous = this.previous();
    this.cursor.set(previous[target - 1] ?? null);
    this.previous.set(previous.slice(0, target - 1));
    this.fetch();
  }
  date(value: string): string { return voucherDate(value); }
  offer(value: AdminVoucher): string { return voucherOffer(value); }
  availability(value: AdminVoucher): string { return voucherAvailability(value); }
  availablePct(value: AdminVoucher): number {
    return value.quota > 0 ? Math.min(100, Math.max(0, Math.round(value.usedCount / value.quota * 100))) : 0;
  }
  clearFilters(): void {
    this.search.set('');
    this.scope.set('ALL');
    this.status.set('ALL');
    this.availabilityFilter.set('ALL');
    this.previous.set([]);
    this.cursor.set(null);
    this.fetch();
  }
  refresh(): void { this.fetch(); }
}

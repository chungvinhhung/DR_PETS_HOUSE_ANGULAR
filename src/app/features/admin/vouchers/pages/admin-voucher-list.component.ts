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

  readonly all = signal<AdminVoucher[]>([]);
  readonly search = signal('');
  readonly scope = signal<VoucherScope | 'ALL'>('ALL');
  readonly status = signal<VoucherStatus | 'ALL'>('ALL');
  readonly loading = signal(false);
  readonly extraFilter = signal(false);
  readonly availabilityFilter = signal('ALL');
  readonly error = signal('');
  readonly cursor = signal<string | null>(null);
  readonly nextCursor = signal<string | null>(null);
  readonly previous = signal<(string | null)[]>([]);
  readonly page = computed(() => this.previous().length + 1);
  readonly canEdit = computed(() => this.session.user()?.systemRole === 'ADMIN');
  readonly filtered = computed(() => {
    const q = this.search().trim().toLocaleLowerCase('vi');
    return this.all().filter(item =>
      (this.availabilityFilter() === 'ALL' || voucherAvailability(item) === this.availabilityFilter()) &&
      (!q || [item.code, item.name].some(v => v.toLocaleLowerCase('vi').includes(q))));
  });
  readonly scopeLabels = VOUCHER_SCOPE_LABELS;

  constructor() { this.fetch(); }
  fetch(): void {
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
        if (this.cursor() !== current) return;
        this.all.set(Array.isArray(result.items) ? result.items : []);
        this.nextCursor.set(result.nextCursor || null);
        this.loading.set(false);
      },
      error: err => {
        if (this.cursor() !== current) return;
        this.loading.set(false); this.all.set([]);
        this.nextCursor.set(null);
        this.error.set(adminErrorMessage(err, 'Không tải được danh sách voucher.'));
      },
    });
  }
  setSearch(value: string): void { this.search.set(value); }
  setAvailability(value: string): void { this.availabilityFilter.set(value); }
  toggleExtra(): void { this.extraFilter.update(v => !v); }
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
    this.search.set('');
    this.availabilityFilter.set('ALL');
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
  date(value: string): string { return voucherDate(value); }
  offer(value: AdminVoucher): string { return voucherOffer(value); }
  availability(value: AdminVoucher): string { return voucherAvailability(value); }
  availablePct(value: AdminVoucher): number {
    return value.quota > 0 ? Math.min(100, Math.max(0, Math.round(value.usedCount / value.quota * 100))) : 0;
  }
  refresh(): void { this.fetch(); }
}

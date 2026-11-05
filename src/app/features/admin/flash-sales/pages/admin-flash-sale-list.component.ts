import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ADMIN_TABLE_PAGE_SIZE, adminPageWindow } from '../../../../shared/utils/admin-table-pagination';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminDataStateComponent } from '../../../../shared/admin-data-state/admin-data-state.component';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AdminToastService, adminErrorMessage } from '../../../../shared/services/admin-toast.service';
import { AdminFlashSaleApiService, AdminFlashSale, FlashSaleDisplayState, flashSaleState, flashSaleDate,
  FLASH_SALE_STATE_LABELS } from '../services/admin-flash-sale-api.service';

@Component({
  selector: 'app-admin-flash-sale-list',
  standalone: true,
  imports: [RouterLink, AdminCatalogShellComponent, AdminDataStateComponent],
  templateUrl: './admin-flash-sale-list.component.html',
  styleUrl: './admin-flash-sale-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminFlashSaleListComponent {
  private readonly api = inject(AdminFlashSaleApiService);
  private readonly session = inject(AuthSessionService);
  private readonly toast = inject(AdminToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly canManage = computed(() => this.session.user()?.systemRole === 'ADMIN');
  readonly rows = signal<AdminFlashSale[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly search = signal('');
  readonly stateFilter = signal<FlashSaleDisplayState | 'ALL'>('ALL');
  readonly cursor = signal<string | null>(null);
  readonly nextCursor = signal<string | null>(null);
  readonly previousCursors = signal<(string | null)[]>([]);
  readonly totalCount = signal<number | null>(null);
  readonly page = computed(() => this.previousCursors().length + 1);
  readonly totalPages = computed(() => this.totalCount() === null ? null : Math.max(1, Math.ceil(this.totalCount()! / ADMIN_TABLE_PAGE_SIZE)));
  readonly visiblePages = computed(() => this.totalPages() === null ? [this.page()] : adminPageWindow(this.page(), this.totalPages()!));
  readonly now = signal(Date.now());
  readonly stateLabels = FLASH_SALE_STATE_LABELS;
  private requestVersion = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.fetch();
    this.interval = setInterval(() => this.now.set(Date.now()), 60000);
    this.destroyRef.onDestroy(() => {
      if (this.searchTimer) clearTimeout(this.searchTimer);
      if (this.interval) clearInterval(this.interval);
    });
  }
  readonly displayRows = computed(() => this.rows());
  state(row: AdminFlashSale): FlashSaleDisplayState {
    return flashSaleState(row, this.now());
  }
  formatDate(value: string): string { return flashSaleDate(value); }
  changeSearch(value: string): void {
    this.search.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {this.reset();}, 300);
  }
  changeState(value: string): void {
    const choices = ['ALL','DRAFT','UPCOMING','RUNNING','PAUSED','ENDED'];
    if (!choices.includes(value)) return;
    this.stateFilter.set(value as FlashSaleDisplayState | 'ALL');
    this.reset();
  }
  private reset(): void {
    this.cursor.set(null);
    this.previousCursors.set([]);
    this.totalCount.set(null);
    this.fetch();
  }
  fetch(): void {
    const version = ++this.requestVersion;
    this.loading.set(true); this.error.set('');
    this.api.list({
      search: this.search(),
      state: this.stateFilter(),
      cursor: this.cursor(),
      limit: ADMIN_TABLE_PAGE_SIZE,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: data => {
        if (version !== this.requestVersion) return;
        this.rows.set(data.items);
        this.nextCursor.set(data.nextCursor);
        this.totalCount.set(data.totalCount ?? null);
        this.loading.set(false);
      },
      error: err => {
        if (version !== this.requestVersion) return;
        this.rows.set([]); this.nextCursor.set(null);
        this.error.set(this.message(err));
        this.loading.set(false);
      },
    });
  }
  private message(err: unknown): string {
    const status = err instanceof HttpErrorResponse ? err.status
      : (typeof err === 'object' && err && 'status' in err ? Number(err.status) : 0);
    if ([404, 405, 501].includes(status)) return 'BE chưa cung cấp API quản lý Flash Sale trên môi trường này.';
    return adminErrorMessage(err, 'Không thể tải danh sách Flash Sale.');
  }
  refresh(): void {this.fetch();}
  next(): void {
    if (this.loading() || !this.nextCursor()) return;
    this.previousCursors.update(current => [...current, this.cursor()]);
    this.cursor.set(this.nextCursor());
    this.fetch();
  }
  previous(): void {
    if (this.loading() || !this.previousCursors().length) return;
    const prev = this.previousCursors();
    this.cursor.set(prev[prev.length - 1]);
    this.previousCursors.set(prev.slice(0, -1));
    this.fetch();
  }
  async goToPage(target: number): Promise<void> {
    if (!Number.isSafeInteger(target) || target < 1 || this.loading() ||
        (this.totalPages() !== null && target > this.totalPages()!)) return;
    const current = this.page();
    if (target === current) return;
    if (target === current + 1) {this.next();return;}
    if (target < current) {
      const previous = this.previousCursors();
      this.cursor.set(previous[target-1] ?? null);
      this.previousCursors.set(previous.slice(0,target-1));
      this.fetch();return;
    }
    // Cursor pagination: walk verified cursor boundaries, never invent offsets.
    const version = ++this.requestVersion;
    let cursor = this.cursor();
    let next = this.nextCursor();
    let previous = [...this.previousCursors()];
    this.loading.set(true);this.error.set('');
    try {
      for (let step = current; step < target; step++) {
        if (!next) throw new Error('Trang không còn dữ liệu.');
        previous = [...previous,cursor];
        cursor = next;
        if (step + 1 < target) {
          const result = await firstValueFrom(this.api.list({
            search:this.search(), state:this.stateFilter(),cursor,limit:ADMIN_TABLE_PAGE_SIZE,
          }));
          if (version !== this.requestVersion || this.destroyRef.destroyed) return;
          next = result.nextCursor;
        }
      }
      if (version !== this.requestVersion) return;
      this.previousCursors.set(previous);
      this.cursor.set(cursor);
      this.fetch();
    } catch(err) {
      if (version !== this.requestVersion) return;
      this.loading.set(false);
      this.toast.show(adminErrorMessage(err,'Không thể chuyển đến trang này.'),'error');
    }
  }
}

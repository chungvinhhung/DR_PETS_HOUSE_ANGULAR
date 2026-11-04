import { firstValueFrom } from 'rxjs';
import { adminPageWindow, countCursorItems } from '../../../../shared/utils/admin-table-pagination';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminDataStateComponent } from "../../../../shared/admin-data-state/admin-data-state.component";
import { AdminToastService, adminErrorMessage } from '../../../../shared/services/admin-toast.service';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import {
  AdminVoucher, AdminVoucherApiService, VoucherScope, VoucherStatus, VOUCHER_SCOPE_LABELS,
  voucherAvailability, voucherDate, voucherOffer,
} from '../services/admin-voucher-api.service';

@Component({
  selector: 'app-admin-voucher-list',
  standalone: true,
  imports: [RouterLink, AdminCatalogShellComponent, AdminDataStateComponent],
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
  private countGeneration = 0;
  private countRequested = false;
  readonly countingPages = signal(false);

  readonly pageSize = 6;
  readonly all = signal<AdminVoucher[]>([]);
  readonly search = signal('');
  readonly scope = signal<VoucherScope | 'ALL'>('ALL');
  readonly status = signal<VoucherStatus | 'ALL'>('ALL');
  readonly loading = signal(false);
  readonly availabilityFilter = signal('ALL');
  readonly availabilityDataset = signal<AdminVoucher[] | null>(null);
  readonly clientPage = signal(1);
  readonly error = signal('');
  readonly cursor = signal<string | null>(null);
  readonly nextCursor = signal<string | null>(null);
  readonly totalCount = signal<number | null>(null);
  readonly totalPages = computed(()=>this.totalCount()===null?null:Math.max(1,Math.ceil(this.totalCount()!/this.pageSize)));
  readonly previous = signal<(string | null)[]>([]);
  readonly page = computed(() =>
    this.availabilityFilter() !== 'ALL' ? this.clientPage() : this.previous().length + 1);
  readonly visiblePageNumbers = computed(() =>
    this.totalPages()===null ? [this.page()] : adminPageWindow(this.page(),this.totalPages()!));
  readonly hasPreviousPage = computed(() =>
    this.availabilityFilter() !== 'ALL' ? this.clientPage() > 1 : this.previous().length > 0);
  readonly hasNextPage = computed(() =>
    this.availabilityFilter() !== 'ALL'
      ? this.clientPage() < (this.totalPages() ?? 1)
      : Boolean(this.nextCursor()));
  readonly canEdit = computed(() => this.session.user()?.systemRole === 'ADMIN');
  readonly hasActiveFilters = computed(() =>
    Boolean(this.search().trim()) || this.scope() !== 'ALL' || this.status() !== 'ALL' ||
    this.availabilityFilter() !== 'ALL' || this.cursor() !== null);
  readonly filtered = computed(() => {
    if (this.availabilityFilter() === 'ALL') return this.all();
    const matched = (this.availabilityDataset() ?? [])
      .filter(item => voucherAvailability(item) === this.availabilityFilter());
    const start = (this.clientPage() - 1) * this.pageSize;
    return matched.slice(start, start + this.pageSize);
  });
  readonly scopeLabels = VOUCHER_SCOPE_LABELS;

  constructor() {
    this.destroyRef.onDestroy(()=>{if(this.searchTimer)clearTimeout(this.searchTimer);});
    this.fetch();
  }
  fetch(): void {
    const request = ++this.requestVersion;
    const current = this.cursor();
    const filters = {
      ...(this.scope() !== 'ALL' ? {scope: this.scope() as VoucherScope} : {}),
      ...(this.status() !== 'ALL' ? {status: this.status() as VoucherStatus} : {}),
      ...(current ? {cursor:current} : {}),
      ...(this.search().trim() ? {search:this.search().trim()} : {}),
      limit: this.pageSize,
    };
    this.loading.set(true);
    this.error.set('');
    this.api.list(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        // A response from an older filter/page selection must never overwrite the latest data.
        if (request !== this.requestVersion) return;
        this.all.set(Array.isArray(result.items) ? result.items : []);
        this.nextCursor.set(result.nextCursor || null);
        if (typeof result.totalCount==='number') this.totalCount.set(result.totalCount);
        else if (this.totalCount()===null) this.countVoucherPages();
        this.loading.set(false);
      },
      error: err => {
        // A response from an older filter/page selection must never overwrite the latest data.
        if (request !== this.requestVersion) return;
        this.loading.set(false); this.all.set([]);
        this.nextCursor.set(null);
        this.totalCount.set(null);
        this.error.set(adminErrorMessage(err, 'Không tải được danh sách voucher.'));
      },
    });
  }
  private invalidateCount():void {
    this.countGeneration++;
    this.countRequested=false;
    this.totalCount.set(null);
    this.countingPages.set(false);
  }
  private countVoucherPages():void {
    if(this.countRequested || this.totalCount()!==null)return;
    this.countRequested=true;
    this.countingPages.set(true);
    const generation=this.countGeneration;
    const filters={
      ...(this.scope()!=='ALL'?{scope:this.scope() as VoucherScope}:{}),
      ...(this.status()!=='ALL'?{status:this.status() as VoucherStatus}:{}),
      ...(this.search().trim()?{search:this.search().trim()}:{}),
      limit:100,
    };
    void countCursorItems((cursor)=>
      this.api.list({...filters,...(cursor?{cursor}:{})})
    ).then(total=>{
      if(generation!==this.countGeneration || this.destroyRef.destroyed)return;
      this.countingPages.set(false);
      if(total!==null)this.totalCount.set(total);
    });
  }
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  setSearch(value: string): void {
    this.search.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer=setTimeout(()=>{
      this.invalidateCount();
      this.previous.set([]); this.cursor.set(null); this.clientPage.set(1);
      if (this.availabilityFilter() === 'ALL') this.fetch();
      else void this.fetchAvailabilityDataset();
    },300);
  }
  setAvailability(value: string): void {
    if (!['ALL', 'Còn lượt', 'Hết lượt', 'Chưa bắt đầu', 'Hết hạn'].includes(value)) return;
    this.availabilityFilter.set(value);
    this.clientPage.set(1);
    this.previous.set([]);
    this.cursor.set(null);
    this.nextCursor.set(null);
    this.invalidateCount();
    if (value === 'ALL') {
      this.availabilityDataset.set(null);
      this.fetch();
    } else {
      void this.fetchAvailabilityDataset();
    }
  }
  setScope(value: string): void {
    if (value !== 'ALL' && !['ORDER','PRODUCT','SERVICE'].includes(value)) return;
    this.scope.set(value as VoucherScope | 'ALL'); this.resetAndFetch();
  }
  setStatus(value: string): void {
    if (value !== 'ALL' && !['ACTIVE','INACTIVE'].includes(value)) return;
    this.status.set(value as VoucherStatus | 'ALL'); this.resetAndFetch();
  }
  resetAndFetch(): void {
    this.invalidateCount();
    this.previous.set([]);
    this.cursor.set(null);
    this.clientPage.set(1);
    if (this.availabilityFilter() === 'ALL') this.fetch();
    else void this.fetchAvailabilityDataset();
  }
  next(): void {
    if (this.loading()) return;
    if (this.availabilityFilter() !== 'ALL') {
      const pages = this.totalPages() ?? 1;
      if (this.clientPage() < pages) this.clientPage.update(page => page + 1);
      return;
    }
    if (!this.nextCursor()) return;
    this.previous.update(a => [...a, this.cursor()]);
    this.cursor.set(this.nextCursor());
    this.fetch();
  }
  prev(): void {
    if (this.loading()) return;
    if (this.availabilityFilter() !== 'ALL') {
      if (this.clientPage() > 1) this.clientPage.update(page => page - 1);
      return;
    }
    const prev = this.previous();
    if (!prev.length) return;
    this.cursor.set(prev[prev.length - 1]);
    this.previous.set(prev.slice(0,-1));
    this.fetch();
  }
  async goToPage(target: number): Promise<void> {
    const count=this.totalPages();
    if (this.availabilityFilter() !== 'ALL') {
      if (Number.isSafeInteger(target) && target >= 1 && (count === null || target <= count) && !this.loading()) {
        this.clientPage.set(target);
      }
      return;
    }
    if(!Number.isSafeInteger(target)||target<1||(count!==null&&target>count)||this.loading())return;
    if(target===this.page())return;
    if(target===this.page()+1){this.next();return;}
    if(target<=this.previous().length){
      const previous=this.previous();
      this.cursor.set(previous[target-1]??null);
      this.previous.set(previous.slice(0,target-1));
      this.fetch();return;
    }
    // Cursor API: discover the intermediate page boundaries before jumping.
    // Unlike offset pagination, a page number cannot be converted to a cursor.
    const requestVersion=++this.requestVersion;
    const startPage=this.page();
    let cursor=this.cursor();
    let previous=[...this.previous()];
    this.loading.set(true);this.error.set('');
    try{
      for(let page=startPage;page<target;page++){
        const result=await firstValueFrom(this.api.list({
          ...(this.scope()!=='ALL'?{scope:this.scope() as VoucherScope}:{}),
          ...(this.status()!=='ALL'?{status:this.status() as VoucherStatus}:{}),
          ...(this.search().trim()?{search:this.search().trim()}:{}),
          ...(cursor?{cursor}:{}),limit:this.pageSize,
        }));
        if(requestVersion!==this.requestVersion||this.destroyRef.destroyed)return;
        if(!result.nextCursor)throw new Error('Trang này không còn dữ liệu.');
        previous=[...previous,cursor];cursor=result.nextCursor;
      }
      this.previous.set(previous);this.cursor.set(cursor);this.fetch();
    }catch{
      if(requestVersion!==this.requestVersion)return;
      this.loading.set(false);this.toast.show('Không thể mở trang này. Vui lòng thử lại.','error');
    }
  }
  private async fetchAvailabilityDataset(): Promise<void> {
    const request = ++this.requestVersion;
    this.loading.set(true);
    this.error.set('');
    this.availabilityDataset.set(null);
    this.nextCursor.set(null);
    try {
      const rows: AdminVoucher[] = [];
      let cursor: string | null = null;
      let pages = 0;
      do {
        const result = await firstValueFrom(this.api.list({
          ...(this.scope() !== 'ALL' ? { scope: this.scope() as VoucherScope } : {}),
          ...(this.status() !== 'ALL' ? { status: this.status() as VoucherStatus } : {}),
          ...(this.search().trim() ? { search: this.search().trim() } : {}),
          ...(cursor ? { cursor } : {}),
          limit: 100,
        }));
        if (request !== this.requestVersion || this.destroyRef.destroyed) return;
        rows.push(...result.items);
        cursor = result.nextCursor || null;
        pages += 1;
      } while (cursor && pages < 50);

      const matched = rows.filter(item =>
        voucherAvailability(item) === this.availabilityFilter());
      this.availabilityDataset.set(rows);
      this.totalCount.set(matched.length);
      this.clientPage.set(Math.min(this.clientPage(), Math.max(1, Math.ceil(matched.length / this.pageSize))));
      this.loading.set(false);
    } catch (error) {
      if (request !== this.requestVersion || this.destroyRef.destroyed) return;
      this.loading.set(false);
      this.availabilityDataset.set([]);
      this.totalCount.set(0);
      this.error.set(adminErrorMessage(error, 'Không tải được danh sách voucher.'));
      this.toast.show(this.error(), 'error');
    }
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
    this.availabilityDataset.set(null);
    this.clientPage.set(1);
    this.previous.set([]);
    this.cursor.set(null);
    this.invalidateCount();
    this.fetch();
  }
  refresh(): void {
    if (this.availabilityFilter() === 'ALL') this.fetch();
    else void this.fetchAvailabilityDataset();
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BehaviorSubject,
  combineLatest,
  catchError,
  debounceTime,
  map,
  of,
  switchMap,
} from 'rxjs';

import { AuthSessionService } from '../../../../core/services/auth-session.service';
import {
  CatalogBranch,
  CatalogFilterMode,
  CatalogFilterStatus,
  CatalogListQuery,
  CatalogService,
} from '../models/service-catalog.model';
import { ServiceCatalogMockRepository } from '../services/service-catalog-mock.repository';

type ListFilters = Omit<CatalogListQuery, 'search'>;
type CatalogAction = 'view' | 'edit' | 'configure';

@Component({
  selector: 'app-service-catalog-list',
  standalone: true,
  templateUrl: './service-catalog-list.component.html',
  styleUrl: './service-catalog-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceCatalogListComponent {
  private readonly repository = inject(ServiceCatalogMockRepository);
  private readonly authSession = inject(AuthSessionService);
  private readonly route = inject(ActivatedRoute);

  private readonly demoState = this.route.snapshot.queryParamMap.get('demoState');
  private failNextRequest = this.demoState === 'error';

  readonly allBranches = this.repository.branches;
  readonly role = computed(() => this.authSession.user()?.systemRole ?? 'STAFF');
  readonly isAdmin = computed(() => this.role() === 'ADMIN');
  readonly canConfigure = computed(() => this.role() === 'ADMIN' || this.role() === 'MANAGER');
  readonly scopedBranches = computed<readonly CatalogBranch[]>(() =>
    this.isAdmin() ? this.allBranches : this.allBranches.slice(0, 1),
  );

  readonly pageSize = 6;
  readonly rows = signal<readonly CatalogService[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly openMenuId = signal<string | null>(null);
  readonly searchText = signal('');

  readonly filters = signal<ListFilters>({
    branchId: 'ALL',
    mode: 'ALL',
    status: 'ALL',
    page: 1,
    pageSize: this.pageSize,
  });

  private readonly searchSubject = new BehaviorSubject('');
  private readonly filterSubject = new BehaviorSubject(this.filters());

  readonly currentPage = computed(() => this.filters().page);
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize)));
  readonly rangeStart = computed(() => this.total() === 0 ? 0 : (this.currentPage() - 1) * this.pageSize + 1);
  readonly rangeEnd = computed(() => Math.min(this.total(), this.currentPage() * this.pageSize));
  readonly pageNumbers = computed(() => {
    const total = this.pageCount();
    const active = this.currentPage();
    const start = Math.max(1, Math.min(active - 2, total - 4));
    const end = Math.min(total, Math.max(5, active + 2));
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  });

  constructor() {
    combineLatest([
      this.searchSubject.pipe(debounceTime(350)),
      this.filterSubject,
    ]).pipe(
      switchMap(([search, filters]) => {
        this.loading.set(true);
        this.error.set(null);
        this.openMenuId.set(null);

        const shouldFail = this.failNextRequest;
        this.failNextRequest = false;

        return this.repository.list(
          { ...filters, search },
          { empty: this.demoState === 'empty', fail: shouldFail },
        ).pipe(
          map((result) => ({ result, error: null as string | null })),
          catchError(() => of({
            result: null,
            error: 'Không tải được danh sách dịch vụ. Vui lòng thử lại.',
          })),
        );
      }),
      takeUntilDestroyed(),
    ).subscribe(({ result, error }) => {
      this.loading.set(false);
      this.error.set(error);
      this.rows.set(result?.items ?? []);
      this.total.set(result?.total ?? 0);
    });
  }

  onSearch(value: string): void {
    this.searchText.set(value);
    if (this.currentPage() !== 1) {
      this.patchFilters({ page: 1 });
    }
    this.searchSubject.next(value);
  }

  setBranch(id: string): void {
    if (id !== 'ALL' && !this.scopedBranches().some((branch) => branch.id === id)) {
      return;
    }
    this.patchFilters({ branchId: id, page: 1 });
  }

  setMode(mode: string): void {
    if (!['ALL', 'BOOKABLE', 'REQUEST_ONLY', 'CONTACT_ONLY'].includes(mode)) {
      return;
    }
    this.patchFilters({ mode: mode as CatalogFilterMode, page: 1 });
  }

  setStatus(status: string): void {
    if (!['ALL', 'ACTIVE', 'INACTIVE'].includes(status)) {
      return;
    }
    this.patchFilters({ status: status as CatalogFilterStatus, page: 1 });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.pageCount() || page === this.currentPage()) {
      return;
    }
    this.patchFilters({ page });
  }

  retry(): void {
    this.filterSubject.next({ ...this.filters() });
  }

  private patchFilters(change: Partial<ListFilters>): void {
    const next = { ...this.filters(), ...change };
    this.filters.set(next);
    this.filterSubject.next(next);
  }

  clearFilters(): void {
    this.searchText.set('');
    this.searchSubject.next('');
    this.patchFilters({ branchId: 'ALL', mode: 'ALL', status: 'ALL', page: 1 });
  }

  isEffectiveEnabled(service: CatalogService, branchId: string): boolean {
    const config = service.branchServices.find((item) => item.branchId === branchId);
    return service.status === 'ACTIVE' && !!config && config.enabled && config.capacity > 0;
  }

  enabledCount(service: CatalogService): number {
    return this.scopedBranches().filter((branch) =>
      this.isEffectiveEnabled(service, branch.id),
    ).length;
  }

  isEnabledAtSelectedBranch(service: CatalogService): boolean {
    return this.isEffectiveEnabled(service, this.filters().branchId);
  }

  availabilityLabel(service: CatalogService): string {
    const branchIds = this.filters().branchId === 'ALL'
      ? this.scopedBranches().map((branch) => branch.id)
      : [this.filters().branchId];
    const configs = service.branchServices.filter((config) => branchIds.includes(config.branchId));
    if (!configs.length) {
      return '—';
    }
    const values = new Set(configs.map((config) => config.availability));
    if (values.size > 1) {
      return 'Nhiều cấu hình';
    }
    return configs[0].availability === 'BY_SHIFT' ? 'Theo ca' : 'Liên hệ';
  }

  executorLabel(value: string): string {
    return value === 'CARE_STAFF_GROOMER' || value === 'CARE_STAFF'
      ? 'CARE STAFF'
      : value === 'VETERINARIAN'
        ? 'VETERINARIAN'
        : value.replaceAll('_', ' ');
  }

  priceLabel(service: CatalogService): string {
    if (service.minFixedTierPrice !== null) {
      return 'Từ ' + this.vnd(service.minFixedTierPrice);
    }
    if (service.referencePrice !== null) {
      return this.vnd(service.referencePrice);
    }
    return service.bookingMode === 'CONTACT_ONLY'
      ? 'Báo giá sau tiếp nhận'
      : 'Liên hệ báo giá';
  }

  private vnd(value: number): string {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value) + 'đ';
  }

  toggleMenu(event: MouseEvent, serviceId: string): void {
    event.stopPropagation();
    this.openMenuId.update((id) => id === serviceId ? null : serviceId);
  }

  @HostListener('document:click')
  closeMenuOnOutsideClick(): void {
    this.openMenuId.set(null);
  }

  @HostListener('document:keydown.escape')
  closeMenuOnEscape(): void {
    this.openMenuId.set(null);
  }

  selectAction(action: CatalogAction, service: CatalogService): void {
    this.openMenuId.set(null);
    const label: Record<CatalogAction, string> = {
      view: 'Xem chi tiết',
      edit: 'Chỉnh sửa',
      configure: 'Cấu hình tại chi nhánh',
    };
    this.notice.set(
      label[action] + ' — ' + service.serviceCode +
      ': giao diện thuộc Phase ' + (action === 'configure' ? '3' : '2') +
      ', chưa tích hợp ở Phase 1.',
    );
  }

  createService(): void {
    this.notice.set('Thêm dịch vụ sẽ được triển khai ở Phase 2; chưa có thao tác lưu dữ liệu.');
  }
}

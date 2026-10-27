import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, inject, signal } from '@angular/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, from, map, mergeMap, of, toArray } from 'rxjs';

import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AdminToastService, adminErrorMessage } from '../../../../shared/services/admin-toast.service';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import {
  BranchServiceConfigDialogComponent, BranchServiceConfigPreview,
} from '../../service-catalog/components/branch-service-config-dialog.component';
import { CatalogBranch, CatalogService } from '../../service-catalog/models/service-catalog.model';
import { BranchHoursPreviewComponent } from './branch-hours-preview.component';
import { BranchShiftTemplatesPreviewComponent } from './branch-shift-templates-preview.component';
import { BranchSettingsDialogComponent, BranchSettingsPreview } from './branch-settings-dialog.component';
import {
  BranchApiRecord, BranchManagementApiService, BranchServiceApiRecord,
  BranchServiceView,
} from '../services/branch-management-api.service';

interface BranchRow extends CatalogBranch {
  address: string;
  hotline: string;
  status: 'ACTIVE' | 'INACTIVE';
  enabledServiceCount: number | null;
  inventory?: { total: number; low: number; out: number };
}
type Tab = 'services' | 'hours' | 'shifts';
type BranchFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';
interface OccupancySnapshot {
  bookedCount: number;
  totalCount: number;
}

@Component({
  selector: 'app-branch-management-page',
  standalone: true,
  imports: [
    RouterLink, AdminCatalogShellComponent, BranchServiceConfigDialogComponent,
    BranchHoursPreviewComponent, BranchShiftTemplatesPreviewComponent,
    BranchSettingsDialogComponent,
  ],
  templateUrl: './branch-management-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchManagementPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(BranchManagementApiService);
  private readonly session = inject(AuthSessionService);
  private readonly toast = inject(AdminToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly branchRows = signal<readonly BranchRow[]>([]);
  readonly detailRecord = signal<BranchRow | null>(null);
  readonly branchListLoading = signal(true);
  readonly branchListError = signal('');
  readonly detailLoading = signal(false);
  readonly detailError = signal('');
  readonly servicesLoading = signal(false);
  readonly servicesError = signal('');
  readonly serviceViews = signal<readonly BranchServiceView[]>([]);
  readonly occupancyByService = signal<Readonly<Record<string, OccupancySnapshot>>>({});
  readonly occupancyLoading = signal(false);
  private occupancyRequestVersion = 0;
  readonly branchSettingsOpen = signal<BranchRow | null>(null);
  readonly servicePickerBranch = signal<BranchRow | null>(null);
  readonly configuredServiceBranch = signal<BranchRow | null>(null);
  readonly activeService = signal<CatalogService | null>(null);
  readonly branchMenuOpen = signal(false);
  readonly savingBranch = signal(false);
  readonly savingConfig = signal(false);
  private lastCreatePayload = '';
  private lastCreateKey = '';

  private readonly routeParams = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  get branchId(): string | null { return this.routeParams().get('id'); }
  get isAdmin(): boolean { return this.session.user()?.systemRole === 'ADMIN'; }

  readonly focusedServiceId = this.route.snapshot.queryParamMap.get('serviceId') ?? '';
  readonly search = signal('');
  readonly branchStatus = signal<BranchFilter>('ALL');
  readonly listPage = signal(1);
  readonly pageSize = 7;
  readonly detailTab = signal<Tab>('services');
  readonly viewDate = signal(this.isoLocal(new Date()));
  readonly viewTime = signal('10:00');

  constructor() {
    this.refreshBranches();
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      this.detailTab.set('services');
      this.branchMenuOpen.set(false);
      this.serviceViews.set([]);
      this.occupancyRequestVersion++;
      this.occupancyByService.set({});
      this.occupancyLoading.set(false);
      this.servicesError.set('');
      if (id) {
        this.fetchDetail(id);
        this.fetchServiceConfigs(id);
      } else {
        this.detailRecord.set(null);
      }
    });
  }

  /** Branch names and addresses must come from BE, never from Figma fixtures. */
  get visibleBranches(): readonly BranchRow[] {
    const branches = this.branchRows();
    if (this.isAdmin) return branches;
    if (this.session.user()?.systemRole !== 'MANAGER') return [];
    const authorized = this.managerAssignedBranches();
    return branches.filter((row) => authorized.includes(row.id));
  }

  private managerAssignedBranches(): readonly string[] {
    // This is UI-only filtering; Backend MUST enforce authorization on every request.
    // AuthUser omits the assigned branches but the Backend JWT includes them.
    const token = this.session.accessToken();
    if (!token) return [];
    try {
      const part = token.split('.')[1];
      if (!part) return [];
      const bytes = atob(part.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - part.length % 4) % 4));
      const claims: { assignedBranchIds?: unknown } = JSON.parse(bytes);
      return Array.isArray(claims.assignedBranchIds)
        ? claims.assignedBranchIds.filter((id): id is string => typeof id === 'string')
        : [];
    } catch { return []; }
  }

  get branch(): BranchRow | null {
    const id = this.branchId;
    if (!id) return null;
    const match = this.visibleBranches.find((row) => row.id === id) ?? this.detailRecord();
    // A Manager must not render an unverified, out-of-scope branch from /branches/:id.
    if (!this.isAdmin && !this.managerAssignedBranches().includes(id)) return null;
    return match?.id === id ? match : null;
  }
  get pickerServices(): readonly CatalogService[] {
    const branchId = this.servicePickerBranch()?.id;
    return branchId ? this.branchServices : [];
  }
  get operationServiceNames(): Readonly<Record<string, string>> {
    return Object.fromEntries(this.serviceViews().map(row => [row.service.id, row.service.name]));
  }
  get branchServices(): readonly CatalogService[] {
    return this.serviceViews().map((row) => row.service);
  }
  get filteredBranches(): readonly BranchRow[] {
    const text = this.search().trim().toLocaleLowerCase('vi');
    return this.visibleBranches.filter((row) =>
      (this.branchStatus() === 'ALL' || row.status === this.branchStatus()) &&
      (!text || [row.name, row.address, row.hotline].some((part) => part.toLocaleLowerCase('vi').includes(text))),
    );
  }
  get pageCount(): number { return Math.max(1, Math.ceil(this.filteredBranches.length / this.pageSize)); }
  get pagedBranches(): readonly BranchRow[] {
    return this.filteredBranches.slice((this.listPage() - 1) * this.pageSize, this.listPage() * this.pageSize);
  }

  private fromApi(value: BranchApiRecord): BranchRow {
    return {
      id: value.id,
      name: value.name,
      address: value.address,
      hotline: value.phone ?? '',
      status: value.status,
      enabledServiceCount: null,
    };
  }

  refreshBranches(): void {
    this.branchListLoading.set(true);
    this.branchListError.set('');
    this.api.listBranches().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => {
        this.branchRows.set(rows.map((row) => this.fromApi(row)));
        this.branchListLoading.set(false);
        this.fetchEnabledCountsForVisibleBranches();
      },
      error: () => {
        this.branchListLoading.set(false);
        this.branchListError.set('Không tải được danh sách chi nhánh. Vui lòng thử lại.');
      },
    });
  }
  private fetchEnabledCountsForVisibleBranches(): void {
    // BE GET /branches does not include enabledServiceCount.
    // Only actual GET service-configs results may populate this column.
    for (const row of this.visibleBranches) {
      this.api.listServiceConfigs(row.id).pipe(
        catchError(() => of(null)),
        takeUntilDestroyed(this.destroyRef),
      ).subscribe((configs) => {
        if (!configs) return;
        const enabledCount = configs.filter((config) => config.enabled).length;
        this.branchRows.update((all) => all.map((branch) =>
          branch.id === row.id ? { ...branch, enabledServiceCount: enabledCount } : branch));
      });
    }
  }

  private fetchDetail(id: string): void {
    this.detailLoading.set(true);
    this.detailError.set('');
    this.detailRecord.set(null);
    this.api.getBranch(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (row) => {
        if (this.branchId !== id) return;
        this.detailRecord.set(this.fromApi(row));
        this.detailLoading.set(false);
        this.api.getInventorySummary(id).pipe(
          catchError(() => of(null)),
          takeUntilDestroyed(this.destroyRef),
        ).subscribe((summary) => {
          if (!summary || this.branchId !== id) return;
          const inventory = {
            total: summary.totalItems,
            low: summary.lowStockItems,
            out: summary.outOfStockItems,
          };
          this.detailRecord.update((current) => current?.id === id ? { ...current, inventory } : current);
        });
      },
      error: () => {
        if (this.branchId !== id) return;
        this.detailLoading.set(false);
        this.detailError.set('Không thể tải chi tiết chi nhánh. Kiểm tra quyền truy cập và thử lại.');
      },
    });
  }
  private fetchServiceConfigs(id: string): void {
    this.servicesLoading.set(true);
    this.servicesError.set('');
    this.api.listBranchServices(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => {
        if (this.branchId !== id) return;
        this.serviceViews.set(rows);
        this.servicesLoading.set(false);
        this.fetchOccupancy();
        const count = rows.filter((row) => row.config?.enabled && row.service.status === 'ACTIVE').length;
        this.branchRows.update((all) => all.map((branch) =>
          branch.id === id ? { ...branch, enabledServiceCount: count } : branch));
      },
      error: () => {
        if (this.branchId !== id) return;
        this.servicesLoading.set(false);
        this.servicesError.set('Không tải được dịch vụ tại chi nhánh. Vui lòng thử lại.');
      },
    });
  }
  retryDetail(): void {
    const id = this.branchId;
    if (!id) return;
    this.fetchDetail(id);
    this.fetchServiceConfigs(id);
  }

  updateSearch(value: string): void { this.search.set(value); this.listPage.set(1); }
  clearFilters(): void { this.search.set(''); this.branchStatus.set('ALL'); this.listPage.set(1); }
  updateBranchStatus(value: string): void {
    if (value !== 'ALL' && value !== 'ACTIVE' && value !== 'INACTIVE') return;
    this.branchStatus.set(value); this.listPage.set(1);
  }
  changePage(page: number): void { if (page >= 1 && page <= this.pageCount) this.listPage.set(page); }
  setDetailTab(tab: Tab): void { this.detailTab.set(tab); }
  branchLink(row: BranchRow): string[] { return ['/admin/branches', row.id]; }
  branchQueryParams(): Record<string, string> | null {
    return this.focusedServiceId ? { serviceId: this.focusedServiceId } : null;
  }
  toggleBranchMenu(): void { this.branchMenuOpen.update((v) => !v); }
  selectBranch(id: string): void {
    if (!this.visibleBranches.some((row) => row.id === id)) return;
    this.branchMenuOpen.set(false);
    this.detailTab.set('services');
    this.closeConfiguration();
  }
  @HostListener('document:keydown.escape')
  onEscape(): void { this.branchMenuOpen.set(false); }
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Element | null;
    if (this.branchMenuOpen() && !target?.closest('.branch-v2-page__branch-choice')) {
      this.branchMenuOpen.set(false);
    }
  }

  openCreateBranch(): void {
    if (!this.isAdmin) {
      this.toast.show('Bạn không có quyền thêm chi nhánh.', 'error');
      return;
    }
    this.lastCreatePayload = '';
    this.lastCreateKey = '';
    this.branchSettingsOpen.set({
      id: '', name: '', address: '', hotline: '', status: 'ACTIVE', enabledServiceCount: null,
    });
  }
  openBranchSettings(row: BranchRow): void {
    if (!this.isAdmin && this.session.user()?.systemRole !== 'MANAGER') {
      this.toast.show('Bạn không có quyền chỉnh sửa chi nhánh.', 'error'); return;
    }
    this.branchSettingsOpen.set(row);
  }
  closeBranchSettings(): void { if (!this.savingBranch()) this.branchSettingsOpen.set(null); }
  saveBranchSettings(value: BranchSettingsPreview): void {
    if (this.savingBranch()) return;
    const payload = {
      name: value.name, address: value.address, phone: value.hotline, status: value.status,
    };
    this.savingBranch.set(true);
    if (!value.id) {
      const serialized = JSON.stringify(payload);
      if (serialized !== this.lastCreatePayload) {
        this.lastCreatePayload = serialized;
        this.lastCreateKey = crypto.randomUUID();
      }
      this.api.createBranch(payload, this.lastCreateKey).pipe(
        takeUntilDestroyed(this.destroyRef),
      ).subscribe({
        next: (saved) => {
          const row = this.fromApi(saved);
          this.branchRows.update((all) => [...all, row]);
          this.savingBranch.set(false);
          this.branchSettingsOpen.set(null);
          this.toast.show('Thêm chi nhánh thành công.', 'success');
          void this.router.navigate(this.branchLink(row));
        },
        error: (error: unknown) => {
          this.savingBranch.set(false);
          this.toast.show(adminErrorMessage(error, 'Không thể thêm chi nhánh.'), 'error');
        },
      });
      return;
    }
    this.api.updateBranch(value.id, payload).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => {
        const row = this.fromApi(saved);
        this.branchRows.update((all) => all.map((x) => x.id === row.id
          ? { ...x, ...row, enabledServiceCount: x.enabledServiceCount } : x));
        this.detailRecord.set(row);
        this.savingBranch.set(false);
        this.branchSettingsOpen.set(null);
        this.toast.show('Cập nhật chi nhánh thành công.', 'success');
      },
      error: (error: unknown) => {
        this.savingBranch.set(false);
        this.toast.show(adminErrorMessage(error, 'Không thể lưu thông tin chi nhánh.'), 'error');
      },
    });
  }

  openServicePicker(row: BranchRow): void {
    // Fetch configs for chosen branch, even from the list page.
    this.servicePickerBranch.set(row);
    this.servicesError.set('');
    this.servicesLoading.set(true);
    this.api.listBranchServices(row.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (items) => {
        if (this.servicePickerBranch()?.id !== row.id) return;
        this.serviceViews.set(items);
        this.servicesLoading.set(false);
      },
      error: () => {
        this.servicesLoading.set(false);
        this.servicesError.set('Không thể tải dịch vụ tại chi nhánh này.');
      },
    });
  }
  closeServicePicker(): void { this.servicePickerBranch.set(null); }
  configurePickedService(service: CatalogService): void {
    const branch = this.servicePickerBranch();
    if (!branch) return;
    this.configuredServiceBranch.set(branch);
    this.activeService.set(service);
    this.servicePickerBranch.set(null);
  }

  private getConfig(service: CatalogService): BranchServiceApiRecord | null {
    return this.serviceViews().find((x) => x.service.id === service.id)?.config ?? null;
  }
  isEnabled(service: CatalogService): boolean {
    return service.status === 'ACTIVE' && Boolean(this.getConfig(service)?.enabled);
  }
  capacity(service: CatalogService): number { return this.getConfig(service)?.capacity ?? 0; }
  previewAvailability(service: CatalogService): string {
    if (!this.isEnabled(service)) return 'Đã tắt';
    if (service.bookingMode !== 'BOOKABLE') return 'Không đặt lịch';
    if (this.occupancyLoading()) return 'Đang tải...';
    const occupancy = this.occupancyByService()[service.id];
    return occupancy ? `${occupancy.bookedCount}/${occupancy.totalCount}` : 'Chưa có dữ liệu';
  }

  /**
   * BE currently returns slots[].remaining, but NOT bookedCount/totalCount.
   * Render the requested occupied/total ratio only when BE returns both.
   * A fully booked start time must also be present in the BE response.
   */
  private fetchOccupancy(): void {
    const requestVersion = ++this.occupancyRequestVersion;
    const branchId = this.branchId;
    const date = this.viewDate();
    const time = this.viewTime();
    this.occupancyByService.set({});

    if (!branchId) {
      this.occupancyLoading.set(false);
      return;
    }
    const services = this.serviceViews().filter((row) =>
      row.service.status === 'ACTIVE' &&
      row.service.bookingMode === 'BOOKABLE' &&
      row.config?.enabled,
    );
    if (!services.length) {
      this.occupancyLoading.set(false);
      return;
    }

    this.occupancyLoading.set(true);
    from(services).pipe(
      mergeMap((row) =>
        this.api.getServiceOccupancy(branchId, row.service.id, date).pipe(
          map((result): { serviceId: string; data: OccupancySnapshot } | null => {
            const slot = result.slots?.find((candidate) =>
              typeof candidate.start === 'string' && candidate.start.slice(11, 16) === time,
            );
            if (!slot ||
                !Number.isInteger(slot.bookedCount) ||
                !Number.isInteger(slot.totalCount) ||
                (slot.bookedCount ?? -1) < 0 ||
                (slot.totalCount ?? -1) < (slot.bookedCount ?? 0)) {
              return null;
            }
            return {
              serviceId: row.service.id,
              data: { bookedCount: slot.bookedCount!, totalCount: slot.totalCount! },
            };
          }),
          catchError(() => of(null)),
        ), 4),
      toArray(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (data) => {
        if (requestVersion !== this.occupancyRequestVersion ||
            this.branchId !== branchId ||
            this.viewDate() !== date ||
            this.viewTime() !== time) return;
        this.occupancyByService.set(Object.fromEntries(
          data.filter((entry): entry is { serviceId: string; data: OccupancySnapshot } =>
            entry !== null).map((entry) => [entry.serviceId, entry.data]),
        ));
        this.occupancyLoading.set(false);
      },
      error: () => {
        if (requestVersion === this.occupancyRequestVersion) this.occupancyLoading.set(false);
      },
    });
  }
  get currentBlockedWindows(): BranchServiceConfigPreview['blockedWindows'] | null { return []; }

  toggleService(service: CatalogService): void {
    const branch = this.branch;
    if (!branch) return;
    const config = this.getConfig(service);
    if (!config) {
      this.toast.show('Dịch vụ chưa có cấu hình tại chi nhánh. Vui lòng mở Cấu hình dịch vụ.', 'info'); return;
    }
    if (service.status !== 'ACTIVE') {
      this.toast.show('Dịch vụ đang ngừng toàn hệ thống.', 'error'); return;
    }
    if (this.savingConfig()) return;
    this.persistServiceConfig(branch.id, service.id, !config.enabled, config.capacity, config.availability);
  }
  openConfiguration(service: CatalogService): void {
    if (!this.branch) return;
    this.configuredServiceBranch.set(this.branch);
    this.activeService.set(service);
  }
  closeConfiguration(): void {
    if (this.savingConfig()) return;
    this.activeService.set(null);
    this.configuredServiceBranch.set(null);
  }
  applyServiceConfiguration(value: BranchServiceConfigPreview): void {
    const existing = this.serviceViews().find((row) => row.service.id === value.serviceId)?.config;
    this.persistServiceConfig(
      value.branchId, value.serviceId, value.enabled, value.capacity,
      existing?.availability ?? [],
    );
  }
  private persistServiceConfig(
    branchId: string, serviceId: string, enabled: boolean, capacity: number,
    availability: BranchServiceApiRecord['availability'],
  ): void {
    if (!Number.isInteger(capacity) || capacity < 1) {
      this.toast.show('Sức chứa đồng thời phải là số nguyên từ 1 trở lên.', 'error'); return;
    }
    if (this.savingConfig()) return;
    this.savingConfig.set(true);
    this.api.updateServiceConfig(branchId, serviceId, {
      enabled, capacity, availability,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (config) => {
        this.serviceViews.update((all) => all.map((row) => row.service.id === serviceId ? {
          ...row,
          config,
          service: {
            ...row.service,
            branchServices: [{
              branchId,
              capacity: config.capacity,
              enabled: config.enabled,
              availability: 'BY_SHIFT' as const,
            }],
          },
        } : row));
        this.savingConfig.set(false);
        this.closeConfiguration();
        this.fetchOccupancy();
        this.branchRows.update((all) => all.map((branch) => branch.id === branchId ? {
          ...branch,
          enabledServiceCount: this.serviceViews().filter((row) => row.config?.enabled).length,
        } : branch));
        this.toast.show('Lưu cấu hình dịch vụ thành công.', 'success');
      },
      error: () => {
        this.savingConfig.set(false);
        this.toast.show('Không lưu được cấu hình dịch vụ. Vui lòng thử lại.', 'error');
      },
    });
  }
  showPending(action: string): void {
    this.toast.show(action + ' hiện chưa khả dụng.', 'info');
  }
  changeDate(value: string): void {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      this.viewDate.set(value);
      this.fetchOccupancy();
    }
  }
  changeTime(value: string): void {
    if (/^\d{2}:\d{2}$/.test(value)) {
      this.viewTime.set(value);
      this.fetchOccupancy();
    }
  }
  refreshPreview(): void { this.fetchOccupancy(); }
  private isoLocal(d: Date): string {
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')].join('-');
  }
}

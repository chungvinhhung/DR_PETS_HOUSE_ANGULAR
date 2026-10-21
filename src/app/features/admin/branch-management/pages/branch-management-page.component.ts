import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, inject, signal } from '@angular/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AdminToastService } from '../../../../shared/services/admin-toast.service';
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
  readonly branchSettingsOpen = signal<BranchRow | null>(null);
  readonly servicePickerBranch = signal<BranchRow | null>(null);
  readonly configuredServiceBranch = signal<BranchRow | null>(null);
  readonly activeService = signal<CatalogService | null>(null);
  readonly branchMenuOpen = signal(false);
  readonly savingBranch = signal(false);
  readonly savingConfig = signal(false);

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
        this.branchListError.set('Không thể tải danh sách chi nhánh từ Backend. Kiểm tra API, đăng nhập hoặc mạng rồi thử lại.');
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
        const count = rows.filter((row) => row.config?.enabled && row.service.status === 'ACTIVE').length;
        this.branchRows.update((all) => all.map((branch) =>
          branch.id === id ? { ...branch, enabledServiceCount: count } : branch));
      },
      error: () => {
        if (this.branchId !== id) return;
        this.servicesLoading.set(false);
        this.servicesError.set('Không thể tải danh sách dịch vụ/capacity từ Backend hoặc tài khoản không có quyền.');
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

  openBranchSettings(row: BranchRow): void {
    if (!this.isAdmin && this.session.user()?.systemRole !== 'MANAGER') {
      this.toast.show('Bạn không có quyền chỉnh sửa chi nhánh.', 'error'); return;
    }
    this.branchSettingsOpen.set(row);
  }
  closeBranchSettings(): void { if (!this.savingBranch()) this.branchSettingsOpen.set(null); }
  saveBranchSettings(value: BranchSettingsPreview): void {
    if (this.savingBranch()) return;
    this.savingBranch.set(true);
    this.api.updateBranch(value.id, {
      name: value.name, address: value.address, phone: value.hotline, status: value.status,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => {
        const row = this.fromApi(saved);
        this.branchRows.update((all) => all.map((x) => x.id === row.id
          ? { ...x, ...row, enabledServiceCount: x.enabledServiceCount } : x));
        this.detailRecord.set(row);
        this.savingBranch.set(false);
        this.branchSettingsOpen.set(null);
        this.toast.show('Đã lưu thông tin chi nhánh lên Backend.', 'success');
      },
      error: () => {
        this.savingBranch.set(false);
        this.toast.show('Không thể lưu chi nhánh. Kiểm tra quyền, dữ liệu hoặc trạng thái API.', 'error');
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
    if (!this.isEnabled(service)) return '0 (đã tắt)';
    return service.availabilityText ?? 'Chờ BE tính khả dụng';
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
    if (value.blockedWindows.length > 0) {
      this.toast.show('BE chưa có API lưu khoảng tạm khóa. Hãy bỏ khoảng tạm khóa để lưu bật/tắt và capacity.', 'error');
      return;
    }
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
      this.toast.show('Capacity phải là số nguyên lớn hơn hoặc bằng 1 theo Backend.', 'error'); return;
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
        this.branchRows.update((all) => all.map((branch) => branch.id === branchId ? {
          ...branch,
          enabledServiceCount: this.serviceViews().filter((row) => row.config?.enabled).length,
        } : branch));
        this.toast.show('Cấu hình dịch vụ đã lưu vào Backend.', 'success');
      },
      error: () => {
        this.savingConfig.set(false);
        this.toast.show('Không lưu được cấu hình dịch vụ. Kiểm tra quyền/API và thử lại.', 'error');
      },
    });
  }
  showPending(action: string): void {
    this.toast.show(action + ': chưa kết nối API phù hợp, dữ liệu không thay đổi.', 'info');
  }
  changeDate(value: string): void {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) this.viewDate.set(value);
  }
  changeTime(value: string): void {
    if (/^\d{2}:\d{2}$/.test(value)) this.viewTime.set(value);
  }
  refreshPreview(): void {
    this.toast.show('Khả dụng theo giờ phải dùng API /availability với serviceIds và ngày; không có số liệu khung giờ giả.', 'info');
  }
  private isoLocal(d: Date): string {
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')].join('-');
  }
}

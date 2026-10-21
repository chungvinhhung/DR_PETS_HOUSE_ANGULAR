import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AdminToastService } from '../../../../shared/services/admin-toast.service';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { BranchServiceConfigDialogComponent } from '../../service-catalog/components/branch-service-config-dialog.component';
import { CatalogBranch, CatalogService } from '../../service-catalog/models/service-catalog.model';
import { ServiceCatalogMockRepository } from '../../service-catalog/services/service-catalog-mock.repository';
import { BranchHoursPreviewComponent } from './branch-hours-preview.component';
import { BranchShiftTemplatesPreviewComponent } from './branch-shift-templates-preview.component';

/**
 * Figma V2 branch screen (7353:38040 / 38072 / 38471 / 38870).
 * Records below reproduce the Figma prototype and are NOT Backend data.
 * TODO(BE): replace fixtures + Manager scope with branch-management APIs.
 */
interface BranchRow extends CatalogBranch {
  address: string;
  hotline: string;
  status: 'ACTIVE' | 'INACTIVE';
  enabledServiceCount: number;
  inventory?: { total: number; low: number; out: number };
}
const FIGMA_BRANCHES: readonly BranchRow[] = [
  { id: 'preview-q10', name: 'Chi nhánh Quận 10', address: '123 Đường Ba Tháng Hai, P.11, Q.10', hotline: '', status: 'ACTIVE', enabledServiceCount: 12 },
  { id: 'preview-binhthanh', name: 'Chi nhánh Bình Thạnh', address: '456 Điện Biên Phủ, P.25, Bình Thạnh', hotline: '', status: 'ACTIVE', enabledServiceCount: 10 },
  { id: 'demo-q1', name: 'Chi nhánh Quận 1', address: '15 Lê Duẩn, Bến Nghé, Quận 1, TP. Hồ Chí Minh', hotline: '0281111222', status: 'ACTIVE', enabledServiceCount: 9, inventory: { total: 245, low: 8, out: 3 } },
  { id: 'demo-q7', name: 'Chi nhánh Quận 7', address: '105 Nguyễn Văn Linh, Tân Phú, Q.7', hotline: '', status: 'ACTIVE', enabledServiceCount: 8 },
  { id: 'preview-govap', name: 'Chi nhánh Gò Vấp', address: '800 Quang Trung, P.8, Gò Vấp', hotline: '', status: 'ACTIVE', enabledServiceCount: 11 },
  { id: 'preview-tanbinh', name: 'Chi nhánh Tân Bình', address: '300 Cộng Hòa, P.13, Tân Bình', hotline: '', status: 'ACTIVE', enabledServiceCount: 7 },
  { id: 'preview-thuduc', name: 'Chi nhánh Thủ Đức', address: '50 Võ Văn Ngân, Bình Thọ, Thủ Đức', hotline: '', status: 'ACTIVE', enabledServiceCount: 6 },
  { id: 'demo-q3', name: 'Chi nhánh Quận 3', address: 'Chưa có thông tin địa chỉ (demo)', hotline: '', status: 'ACTIVE', enabledServiceCount: 0 },
];
type Tab = 'services' | 'hours' | 'shifts';
type BranchFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

@Component({
  selector: 'app-branch-management-page',
  standalone: true,
  imports: [RouterLink, AdminCatalogShellComponent, BranchServiceConfigDialogComponent, BranchHoursPreviewComponent, BranchShiftTemplatesPreviewComponent],
  templateUrl: './branch-management-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchManagementPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly repository = inject(ServiceCatalogMockRepository);
  private readonly session = inject(AuthSessionService);
  private readonly toast = inject(AdminToastService);

  readonly isAdmin = this.session.user()?.systemRole === 'ADMIN';
  // Existing mock scope ONLY. Never use this frontend array as an authorization boundary.
  readonly visibleBranches: readonly BranchRow[] = this.isAdmin
    ? FIGMA_BRANCHES
    : FIGMA_BRANCHES.filter((row) => row.id === this.repository.branches[0]?.id);
  readonly branchId = this.route.snapshot.paramMap.get('id');
  readonly branch = this.visibleBranches.find((row) => row.id === this.branchId) ?? null;
  readonly focusedServiceId = this.route.snapshot.queryParamMap.get('serviceId') ?? '';
  readonly search = signal('');
  readonly branchStatus = signal<BranchFilter>('ALL');
  readonly listPage = signal(1);
  readonly pageSize = 7;
  readonly detailTab = signal<Tab>('services');
  readonly viewDate = signal(this.isoLocal(new Date()));
  readonly viewTime = signal('10:00');
  readonly feedback = signal('');
  readonly activeService = signal<CatalogService | null>(null);
  readonly serviceOverrides = signal<Record<string, boolean>>({});

  readonly branchServices: readonly CatalogService[] = this.loadBranchServices();

  get filteredBranches(): readonly BranchRow[] {
    const q = this.search().trim().toLocaleLowerCase('vi');
    return this.visibleBranches.filter((row) =>
      (this.branchStatus() === 'ALL' || row.status === this.branchStatus()) &&
      (!q || [row.name, row.address, row.hotline].some((text) => text.toLocaleLowerCase('vi').includes(q))),
    );
  }
  get pageCount(): number { return Math.max(1, Math.ceil(this.filteredBranches.length / this.pageSize)); }
  get pagedBranches(): readonly BranchRow[] {
    return this.filteredBranches.slice((this.listPage() - 1) * this.pageSize, this.listPage() * this.pageSize);
  }
  updateSearch(value: string): void { this.search.set(value); this.listPage.set(1); }
  updateBranchStatus(value: string): void {
    if (value !== 'ALL' && value !== 'ACTIVE' && value !== 'INACTIVE') return;
    this.branchStatus.set(value);
    this.listPage.set(1);
  }
  changePage(page: number): void { if (page > 0 && page <= this.pageCount) this.listPage.set(page); }
  setDetailTab(tab: Tab): void { this.detailTab.set(tab); this.feedback.set(''); }
  branchLink(item: BranchRow): string[] { return ['/admin/branches', item.id]; }
  branchQueryParams(): Record<string, string> | null {
    return this.focusedServiceId ? { serviceId: this.focusedServiceId } : null;
  }
  isEnabled(service: CatalogService): boolean {
    const fallback = service.branchServices.find((row) => row.branchId === this.branch?.id)?.enabled ?? false;
    return service.status === 'ACTIVE' && (this.serviceOverrides()[service.id] ?? fallback);
  }
  capacity(service: CatalogService): number {
    return service.branchServices.find((row) => row.branchId === this.branch?.id)?.capacity ?? 0;
  }
  previewAvailability(service: CatalogService): string {
    if (!this.isEnabled(service)) return '0 (đã tắt)';
    if (this.branch?.id !== 'demo-q1') return '—';
    const values: Record<string, number> = { 'demo-1': 2, 'demo-3': 1, 'demo-7': 0 };
    const value = values[service.id];
    return value === undefined ? '—' : 'Còn ' + value + ' ca';
  }
  toggleService(service: CatalogService): void {
    if (service.status !== 'ACTIVE' || this.capacity(service) <= 0) {
      this.toast.show('Không thể bật dịch vụ đã ngừng hoặc sức chứa bằng 0.', 'error');
      return;
    }
    this.serviceOverrides.update((entries) => ({ ...entries, [service.id]: !this.isEnabled(service) }));
    this.toast.show('Đã đổi trạng thái trên giao diện thử nghiệm; chưa lưu lên hệ thống.', 'info');
  }
  openConfiguration(service: CatalogService): void {
    const updated = service.branchServices.map((row) =>
      row.branchId === this.branch?.id ? { ...row, enabled: this.isEnabled(service) } : row,
    );
    this.activeService.set({ ...service, branchServices: updated });
  }
  closeConfiguration(): void { this.activeService.set(null); }
  showPending(action: string): void {
    this.toast.show(action + ': chưa có API, chưa thực hiện lưu dữ liệu.', 'info');
  }
  changeDate(value: string): void {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) { this.viewDate.set(value); this.feedback.set(''); }
  }
  changeTime(value: string): void {
    if (/^\d{2}:\d{2}$/.test(value)) { this.viewTime.set(value); this.feedback.set(''); }
  }
  refreshPreview(): void {
    this.toast.show('Đang xem ' + this.viewDate() + ' lúc ' + this.viewTime() + '. Chưa có API tính khả dụng.', 'info');
  }
  private isoLocal(d: Date): string {
    return [d.getFullYear(), String(d.getMonth()+1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  }
  private loadBranchServices(): readonly CatalogService[] {
    if (!this.branch) return [];
    if (this.branch.id === 'demo-q1') {
      const configurations = [
        { id: 'demo-1', capacity: 5, enabled: true },
        { id: 'demo-3', capacity: 2, enabled: true },
        { id: 'demo-7', capacity: 3, enabled: true },
        { id: 'demo-4', capacity: 2, enabled: false },
      ];
      return configurations.flatMap(({ id, capacity, enabled }) => {
        const service = this.repository.getById(id);
        if (!service) return [];
        return [{
          ...service,
          name: id === 'demo-3' ? 'Khám tổng quát' : service.name,
          branchServices: [
            ...service.branchServices.filter((item) => item.branchId !== this.branch!.id),
            { branchId: this.branch!.id, capacity, enabled, availability: 'BY_SHIFT' as const },
          ],
        }];
      });
    }
    return this.repository.getAll().filter((service) =>
      service.branchServices.some((row) => row.branchId === this.branch!.id),
    );
  }
}

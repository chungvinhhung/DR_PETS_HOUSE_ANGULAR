import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { BranchServiceConfigDialogComponent } from '../../service-catalog/components/branch-service-config-dialog.component';
import { CatalogBranch, CatalogService } from '../../service-catalog/models/service-catalog.model';
import { ServiceCatalogMockRepository } from '../../service-catalog/services/service-catalog-mock.repository';

/**
 * WBS 3.7: branch-scoped Service & Capacity UI preview.
 * All branches and services are illustrative; BE must enforce real assignedBranches.
 */
@Component({
  selector: 'app-branch-management-page',
  standalone: true,
  imports: [RouterLink, AdminCatalogShellComponent, BranchServiceConfigDialogComponent],
  templateUrl: './branch-management-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchManagementPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly repository = inject(ServiceCatalogMockRepository);
  private readonly session = inject(AuthSessionService);

  readonly isAdmin = this.session.user()?.systemRole === 'ADMIN';
  readonly visibleBranches: readonly CatalogBranch[] = this.isAdmin
    ? this.repository.branches
    : this.repository.branches.slice(0, 1); // Demo only; use BE scope in production.

  readonly branchId = this.route.snapshot.paramMap.get('id');
  readonly branch = this.visibleBranches.find((item) => item.id === this.branchId) ?? null;
  readonly focusedServiceId = this.route.snapshot.queryParamMap.get('serviceId') || '';
  readonly focusedService = this.repository.getById(this.focusedServiceId);
  readonly allServices = this.repository.getAll();
  readonly search = signal('');
  readonly activeService = signal<CatalogService | null>(null);

  get pageTitle(): string {
    return this.branch?.name ?? 'Chi nhánh';
  }

  get filteredServices(): readonly CatalogService[] {
    const q = this.search().trim().toLocaleLowerCase('vi');
    if (!q) return this.allServices;
    return this.allServices.filter((service) =>
      service.name.toLocaleLowerCase('vi').includes(q) ||
      service.serviceCode.toLocaleLowerCase('vi').includes(q),
    );
  }

  get hasFocusedService(): boolean {
    return !!this.focusedService;
  }

  canNavigateToBranch(item: CatalogBranch): boolean {
    return this.visibleBranches.some((branch) => branch.id === item.id);
  }

  branchLink(branch: CatalogBranch): string[] {
    return ['/admin/branches', branch.id];
  }

  branchQueryParams(): Record<string, string> | null {
    return this.focusedServiceId ? { serviceId: this.focusedServiceId } : null;
  }

  getEnabledCount(branch: CatalogBranch): number {
    return this.allServices.filter((service) => this.isEnabled(service, branch.id)).length;
  }

  config(service: CatalogService, branchId: string): { capacity: number; enabled: boolean } {
    const entry = service.branchServices.find((item) => item.branchId === branchId);
    return {
      capacity: entry?.capacity ?? 0,
      enabled: !!entry?.enabled,
    };
  }

  isEnabled(service: CatalogService, branchId: string): boolean {
    const config = this.config(service, branchId);
    return service.status === 'ACTIVE' && config.enabled && config.capacity > 0;
  }

  openConfiguration(service: CatalogService): void {
    if (!this.branch) return;
    this.activeService.set(service);
  }

  closeConfiguration(): void {
    this.activeService.set(null);
  }

  returnToCatalog(): void {
    void this.router.navigateByUrl('/admin/services');
  }
}

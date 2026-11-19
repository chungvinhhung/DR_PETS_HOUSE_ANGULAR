import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminBreadcrumbComponent } from '../../../../shared/admin-breadcrumb/admin-breadcrumb.component';
import { AdminDataStateComponent } from '../../../../shared/admin-data-state/admin-data-state.component';
@Component({selector:'app-admin-report-detail',standalone:true,imports:[AdminCatalogShellComponent,AdminBreadcrumbComponent,AdminDataStateComponent],templateUrl:'./admin-report-detail.component.html',styleUrl:'./admin-report-detail.component.scss',changeDetection:ChangeDetectionStrategy.OnPush})
export class AdminReportDetailComponent{}
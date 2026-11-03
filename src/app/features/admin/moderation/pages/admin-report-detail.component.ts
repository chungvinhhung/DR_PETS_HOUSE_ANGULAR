import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminBreadcrumbComponent } from '../../../../shared/admin-breadcrumb/admin-breadcrumb.component';
@Component({selector:'app-admin-report-detail',standalone:true,imports:[RouterLink,AdminCatalogShellComponent,AdminBreadcrumbComponent],templateUrl:'./admin-report-detail.component.html',styleUrl:'./admin-report-detail.component.scss',changeDetection:ChangeDetectionStrategy.OnPush})
export class AdminReportDetailComponent{}
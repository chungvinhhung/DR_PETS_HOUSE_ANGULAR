import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
@Component({selector:'app-admin-report-detail',standalone:true,imports:[RouterLink,AdminCatalogShellComponent],templateUrl:'./admin-report-detail.component.html',styleUrl:'./admin-report-detail.component.scss',changeDetection:ChangeDetectionStrategy.OnPush})
export class AdminReportDetailComponent{}
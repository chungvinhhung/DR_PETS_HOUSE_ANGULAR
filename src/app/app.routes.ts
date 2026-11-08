import { CanDeactivateFn, Routes } from '@angular/router';

import { adminLoginEntryGuard } from './core/guards/admin-login-entry.guard';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { orderOperatorGuard } from './core/guards/order-operator.guard';
import { appointmentCreateGuard } from './core/guards/appointment-create.guard';

const BACKOFFICE_ROLES = ['ADMIN', 'MANAGER', 'STAFF'];

/** Protect create/edit product drafts even when leaving via sidebar or browser Back. */
interface ProductLeaveAware {
  canLeavePage(): boolean | Promise<boolean>;
}
const confirmProductLeave: CanDeactivateFn<ProductLeaveAware> = (component) => component.canLeavePage();

const confirmStaffLeave: CanDeactivateFn<{ canLeavePage(): boolean | Promise<boolean> }> = component => component.canLeavePage();
const confirmVoucherLeave: CanDeactivateFn<{ canLeavePage(): boolean | Promise<boolean> }> = component => component.canLeavePage();
const confirmFlashSaleLeave: CanDeactivateFn<{ canLeavePage(): boolean | Promise<boolean> }> = component => component.canLeavePage();
const confirmAppointmentCreateLeave: CanDeactivateFn<{ canLeavePage(): boolean | Promise<boolean> }> = component => component.canLeavePage();
const confirmOrderCreateLeave: CanDeactivateFn<{ canLeavePage(): boolean | Promise<boolean> }> = component => component.canLeavePage();

export const routes: Routes = [
  {
    path: 'admin/appointments',
    canActivate: [authGuard, roleGuard],
    data: { roles: BACKOFFICE_ROLES },
    loadComponent: () =>
      import('./features/admin/pages/appointments/admin-appointments-page.component')
        .then(component => component.AdminAppointmentsPageComponent),
  },
  {
    path: 'admin/appointments/new',
    canActivate: [authGuard, roleGuard, appointmentCreateGuard],
    canDeactivate: [confirmAppointmentCreateLeave],
    data: { roles: ['ADMIN', 'MANAGER', 'STAFF'] },
    loadComponent: () => import('./features/admin/pages/appointments/admin-appointment-create.component')
      .then(c => c.AdminAppointmentCreateComponent),
  },
  {
    path: 'admin/service-records/:id',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER', 'STAFF'] },
    loadComponent: () => import('./features/admin/pages/appointments/admin-service-record-detail.component')
      .then(c => c.AdminServiceRecordDetailComponent),
  },
  {
    path: 'admin/service-records',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER', 'STAFF'] },
    loadComponent: () => import('./features/admin/pages/appointments/admin-service-records.component')
      .then(c => c.AdminServiceRecordsComponent),
  },
  {
    path: 'admin/appointments/:id',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER', 'STAFF'] },
    loadComponent: () => import('./features/admin/pages/appointments/admin-appointment-detail.component')
      .then(c => c.AdminAppointmentDetailComponent),
  },
  {
    path: 'admin/staff/schedule',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER', 'STAFF'] },
    loadComponent: () => import('./features/admin/staff/pages/admin-staff-schedule.component')
      .then(component => component.AdminStaffScheduleComponent),
  },
  {
    path: 'admin/staff/shifts/assign',
    pathMatch: 'full',
    redirectTo: 'admin/staff/schedule',
  },
  {
    path: 'admin/staff/new',
    canActivate: [authGuard, roleGuard],
    canDeactivate: [confirmStaffLeave],
    data: { roles: ['ADMIN', 'MANAGER'], mode: 'create' },
    loadComponent: () => import('./features/admin/staff/pages/admin-staff-form.component')
      .then(component => component.AdminStaffFormComponent),
  },
  {
    path: 'admin/staff/:id/edit',
    canActivate: [authGuard, roleGuard],
    canDeactivate: [confirmStaffLeave],
    data: { roles: ['ADMIN', 'MANAGER'], mode: 'edit' },
    loadComponent: () => import('./features/admin/staff/pages/admin-staff-form.component')
      .then(component => component.AdminStaffFormComponent),
  },
  {
    path: 'admin/staff/:id',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER'] },
    loadComponent: () =>
      import('./features/admin/staff/pages/admin-staff-detail.component')
        .then(component => component.AdminStaffDetailComponent),
  },
  {
    path: 'admin/staff',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER'] },
    loadComponent: () =>
      import('./features/admin/staff/pages/admin-staff-list.component')
        .then(component => component.AdminStaffListComponent),
  },

  {
    path: 'admin/inventory',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER'] },
    loadComponent: () => import('./features/admin/inventory/pages/admin-inventory-page.component').then(c => c.AdminInventoryPageComponent),
  },
  {
    path: 'admin/branches/:id',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER'] },
    loadComponent: () =>
      import('./features/admin/branch-management/pages/branch-management-page.component')
        .then((component) => component.BranchManagementPageComponent),
  },
  {
    path: 'admin/branches',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER'] },
    loadComponent: () =>
      import('./features/admin/branch-management/pages/branch-management-page.component')
        .then((component) => component.BranchManagementPageComponent),
  },
  {
    path: 'admin/services/new',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN'], editorMode: 'create' },
    loadComponent: () =>
      import('./features/admin/service-catalog/pages/service-catalog-editor.component')
        .then((component) => component.ServiceCatalogEditorComponent),
  },
  {
    path: 'admin/services/:id/edit',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN'], editorMode: 'edit' },
    loadComponent: () =>
      import('./features/admin/service-catalog/pages/service-catalog-editor.component')
        .then((component) => component.ServiceCatalogEditorComponent),
  },
  {
    path: 'admin/services/:id',
    canActivate: [authGuard, roleGuard],
    data: { roles: BACKOFFICE_ROLES, editorMode: 'view' },
    loadComponent: () =>
      import('./features/admin/service-catalog/pages/service-catalog-editor.component')
        .then((component) => component.ServiceCatalogEditorComponent),
  },
  {
    path: 'admin/services',
    canActivate: [authGuard, roleGuard],
    data: { roles: BACKOFFICE_ROLES },
    loadComponent: () =>
      import(
        './features/admin/service-catalog/pages/service-catalog-list.component'
      ).then((component) => component.ServiceCatalogListComponent),
  },
  {
    path: 'admin/flash-sales/new',
    canActivate: [authGuard, roleGuard],
    canDeactivate: [confirmFlashSaleLeave],
    data: {roles: ['ADMIN'], mode:'create'},
    loadComponent: () => import('./features/admin/flash-sales/pages/admin-flash-sale-editor.component')
      .then(c => c.AdminFlashSaleEditorComponent),
  },
  {
    path: 'admin/flash-sales/:id/edit',
    canActivate: [authGuard, roleGuard],
    canDeactivate: [confirmFlashSaleLeave],
    data: {roles: ['ADMIN'], mode:'edit'},
    loadComponent: () => import('./features/admin/flash-sales/pages/admin-flash-sale-editor.component')
      .then(c => c.AdminFlashSaleEditorComponent),
  },
  {
    path: 'admin/flash-sales/:id',
    canActivate: [authGuard, roleGuard],
    data: {roles: ['ADMIN','MANAGER'], mode:'view'},
    loadComponent: () => import('./features/admin/flash-sales/pages/admin-flash-sale-editor.component')
      .then(c => c.AdminFlashSaleEditorComponent),
  },
  {
    path: 'admin/flash-sales',
    canActivate: [authGuard, roleGuard],
    data: {roles: ['ADMIN','MANAGER']},
    loadComponent: () => import('./features/admin/flash-sales/pages/admin-flash-sale-list.component')
      .then(c => c.AdminFlashSaleListComponent),
  },
  {
    path: 'admin/vouchers/new',
    canActivate: [authGuard, roleGuard],
    canDeactivate: [confirmVoucherLeave],
    data: { roles: ['ADMIN'], mode: 'create' },
    loadComponent: () => import('./features/admin/vouchers/pages/admin-voucher-editor.component')
      .then(c => c.AdminVoucherEditorComponent),
  },
  {
    path: 'admin/vouchers/:id/edit',
    canActivate: [authGuard, roleGuard],
    canDeactivate: [confirmVoucherLeave],
    data: { roles: ['ADMIN'], mode: 'edit' },
    loadComponent: () => import('./features/admin/vouchers/pages/admin-voucher-editor.component')
      .then(c => c.AdminVoucherEditorComponent),
  },
  {
    path: 'admin/vouchers/:id',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER'], mode: 'view' },
    loadComponent: () => import('./features/admin/vouchers/pages/admin-voucher-editor.component')
      .then(c => c.AdminVoucherEditorComponent),
  },
  {
    path: 'admin/vouchers',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER'] },
    loadComponent: () => import('./features/admin/vouchers/pages/admin-voucher-list.component')
      .then(c => c.AdminVoucherListComponent),
  },
  {
    path: 'admin/order-returns/:id',
    canActivate: [authGuard, roleGuard, orderOperatorGuard],
    data: { roles: ['ADMIN', 'MANAGER', 'STAFF'] },
    loadComponent: () => import('./features/admin/orders/pages/admin-order-return-detail.component')
      .then(component => component.AdminOrderReturnDetailComponent),
  },
  {
    path: 'admin/orders/new',
    canActivate: [authGuard, roleGuard, orderOperatorGuard],
    canDeactivate: [confirmOrderCreateLeave],
    data: { roles: ['ADMIN', 'MANAGER', 'STAFF'] },
    loadComponent: () => import('./features/admin/orders/pages/admin-order-create.component')
      .then(component => component.AdminOrderCreateComponent),
  },
  {
    path: 'admin/orders/:id',
    canActivate: [authGuard, roleGuard, orderOperatorGuard],
    data: { roles: ['ADMIN', 'MANAGER', 'STAFF'] },
    loadComponent: () => import('./features/admin/orders/pages/admin-order-management.component')
      .then(component => component.AdminOrderManagementComponent),
  },
  {
    path: 'admin/orders',
    canActivate: [authGuard, roleGuard, orderOperatorGuard],
    data: { roles: ['ADMIN', 'MANAGER', 'STAFF'] },
    loadComponent: () => import('./features/admin/orders/pages/admin-order-management.component')
      .then(component => component.AdminOrderManagementComponent),
  },
  {
    path: 'admin/customers/:customerId/pets/:petId',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER', 'STAFF'] },
    loadComponent: () => import('./features/admin/customers/pages/admin-customer-pet-detail.component')
      .then(c => c.AdminCustomerPetDetailComponent),
  },
  {
    path: 'admin/customers/:id',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER'] },
    loadComponent: () => import('./features/admin/customers/pages/admin-customer-detail.component')
      .then(c => c.AdminCustomerDetailComponent),
  },
  {
    path: 'admin/customers',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER'] },
    loadComponent: () => import('./features/admin/customers/pages/admin-customer-list.component')
      .then(c => c.AdminCustomerListComponent),
  },
  {
    path: 'admin/content/articles/new',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN'] },
    loadComponent: () => import('./features/admin/content/pages/admin-article-editor.component')
      .then(c => c.AdminArticleEditorComponent),
  },
  {
    path: 'admin/content/articles/:id/edit',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN'] },
    loadComponent: () => import('./features/admin/content/pages/admin-article-editor.component')
      .then(c => c.AdminArticleEditorComponent),
  },
  {
    path: 'admin/content/articles',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER'], contentMode: 'articles' },
    loadComponent: () => import('./features/admin/content/pages/admin-content-list.component')
      .then(c => c.AdminContentListComponent),
  },
  {
    path: 'admin/content/first-aid/new',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN'] },
    loadComponent: () => import('./features/admin/content/pages/admin-first-aid-editor.component')
      .then(c => c.AdminFirstAidEditorComponent),
  },
  {
    path: 'admin/content/first-aid/:id/edit',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN'] },
    loadComponent: () => import('./features/admin/content/pages/admin-first-aid-editor.component')
      .then(c => c.AdminFirstAidEditorComponent),
  },
  {
    path: 'admin/content/first-aid',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER'], contentMode: 'first-aid' },
    loadComponent: () => import('./features/admin/content/pages/admin-content-list.component')
      .then(c => c.AdminContentListComponent),
  },
  {
    path: 'admin/content/community/new',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN'] },
    loadComponent: () => import('./features/admin/content/pages/admin-community-create.component')
      .then(c => c.AdminCommunityCreateComponent),
  },
  {
    path: 'admin/content/community',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER'], contentMode: 'community' },
    loadComponent: () => import('./features/admin/content/pages/admin-content-list.component')
      .then(c => c.AdminContentListComponent),
  },
  {
    path: 'admin/content/adoptions/:id',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER'] },
    loadComponent: () => import('./features/admin/content/pages/admin-adoption-detail.component')
      .then(c => c.AdminAdoptionDetailComponent),
  },
  {
    path: 'admin/content/adoptions',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER'], contentMode: 'adoptions' },
    loadComponent: () => import('./features/admin/content/pages/admin-content-list.component')
      .then(c => c.AdminContentListComponent),
  },
  {
    path: 'admin/content/rescue/new',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER'] },
    loadComponent: () => import('./features/admin/content/pages/admin-rescue-editor.component')
      .then(c => c.AdminRescueEditorComponent),
  },
  {
    path: 'admin/content/rescue/:id/edit',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER'] },
    loadComponent: () => import('./features/admin/content/pages/admin-rescue-editor.component')
      .then(c => c.AdminRescueEditorComponent),
  },
  {
    path: 'admin/content/rescue',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER'], contentMode: 'rescue' },
    loadComponent: () => import('./features/admin/content/pages/admin-content-list.component')
      .then(c => c.AdminContentListComponent),
  },
  {
    path: 'admin/moderation/reviews',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER'], moderationMode: 'reviews' },
    loadComponent: () => import('./features/admin/moderation/pages/admin-moderation-list.component')
      .then(c => c.AdminModerationListComponent),
  },
  {
    path: 'admin/moderation/feedback/:id',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER'] },
    loadComponent: () => import('./features/admin/moderation/pages/admin-feedback-detail.component')
      .then(c => c.AdminFeedbackDetailComponent),
  },
  {
    path: 'admin/moderation/feedback',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER'], moderationMode: 'feedback' },
    loadComponent: () => import('./features/admin/moderation/pages/admin-moderation-list.component')
      .then(c => c.AdminModerationListComponent),
  },
  {
    path: 'admin/moderation/reports/:id',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER'] },
    loadComponent: () => import('./features/admin/moderation/pages/admin-report-detail.component')
      .then(c => c.AdminReportDetailComponent),
  },
  {
    path: 'admin/moderation/reports',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN', 'MANAGER'], moderationMode: 'reports' },
    loadComponent: () => import('./features/admin/moderation/pages/admin-moderation-list.component')
      .then(c => c.AdminModerationListComponent),
  },
  {
    path: 'admin',
    pathMatch: 'full',
    canActivate: [adminLoginEntryGuard],
    loadComponent: () =>
      import('./features/admin/auth/pages/login/admin-login-page.component').then(
        (component) => component.AdminLoginPageComponent,
      ),
  },
  {
    path: 'admin/login',
    canActivate: [adminLoginEntryGuard],
    loadComponent: () =>
      import('./features/admin/auth/pages/login/admin-login-page.component').then(
        (component) => component.AdminLoginPageComponent,
      ),
  },
  {
    path: 'admin/forbidden',
    loadComponent: () =>
      import(
        './features/admin/auth/pages/forbidden/admin-forbidden-page.component'
      ).then((component) => component.AdminForbiddenPageComponent),
  },
  {
    path: 'admin/profile',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN'] },
    loadComponent: () =>
      import('./features/admin/auth/pages/profile/admin-profile-page.component')
        .then(c => c.AdminProfilePageComponent),
  },
  {
    path: 'admin/categories',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN'] },
    loadComponent: () =>
      import('./features/admin/categories/pages/admin-category-page.component').then(
        (component) => component.AdminCategoryPageComponent,
      ),
  },
  {
    path: 'admin/products',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['ADMIN'] },
    loadComponent: () =>
      import('./features/admin/products/pages/list/admin-product-list-page.component').then(
        (component) => component.AdminProductListPageComponent,
      ),
  },
  {
    path: 'admin/products/:id/edit',
    canActivate: [authGuard, roleGuard],
    canDeactivate: [confirmProductLeave],
    data: { roles: ['ADMIN'] },
    loadComponent: () =>
      import('./features/admin/products/pages/edit/admin-product-edit-page.component').then(
        (component) => component.AdminProductEditPageComponent,
      ),
  },
  {
    path: 'admin/products/new',
    canActivate: [authGuard, roleGuard],
    canDeactivate: [confirmProductLeave],
    data: { roles: ['ADMIN'] },
    loadComponent: () =>
      import('./features/admin/products/pages/create/admin-product-create-page.component').then(
        (component) => component.AdminProductCreatePageComponent,
      ),
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard],
    data: {
      roles: BACKOFFICE_ROLES,
    },
    loadComponent: () =>
      import('./layouts/admin-layout/admin-layout.component').then(
        (component) => component.AdminLayoutComponent,
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        canActivate: [roleGuard],
        data: { roles: ['ADMIN', 'MANAGER'] },
        loadComponent: () =>
          import(
            './features/admin/pages/dashboard/admin-dashboard-page.component'
          ).then((component) => component.AdminDashboardPageComponent),
      },
      {
        path: 'users',
        canActivate: [roleGuard],
        data: {
          roles: ['ADMIN', 'MANAGER'],
        },
        loadComponent: () =>
          import(
            './features/admin/users/pages/admin-users-page.component'
          ).then((component) => component.AdminUsersPageComponent),
      },
    ],
  },
  {
    // Customer UI is isolated in its own lazy-loaded layout and routes.
    path: '',
    loadComponent: () =>
      import('./layouts/customer/customer-layout/customer-layout.component').then(
        (component) => component.CustomerLayoutComponent,
      ),
    loadChildren: () =>
      import('./features/customer/customer.routes').then((m) => m.CUSTOMER_ROUTES),
  },
  {
    path: '**',
    redirectTo: '',
  },
];

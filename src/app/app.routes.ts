import { Routes } from '@angular/router';

import { adminLoginEntryGuard } from './core/guards/admin-login-entry.guard';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

const BACKOFFICE_ROLES = ['ADMIN', 'MANAGER', 'STAFF'];

export const routes: Routes = [
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
        loadComponent: () =>
          import(
            './features/admin/pages/dashboard/admin-dashboard-page.component'
          ).then((component) => component.AdminDashboardPageComponent),
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./features/admin/pages/orders/admin-orders-page.component').then(
            (component) => component.AdminOrdersPageComponent,
          ),
      },
      {
        path: 'appointments',
        loadComponent: () =>
          import(
            './features/admin/pages/appointments/admin-appointments-page.component'
          ).then((component) => component.AdminAppointmentsPageComponent),
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
      {
        path: 'profile',
        loadComponent: () =>
          import(
            './features/admin/auth/pages/profile/admin-profile-page.component'
          ).then((component) => component.AdminProfilePageComponent),
      },
    ],
  },
  {
    path: '',
    loadComponent: () =>
      import('./layouts/customer-layout/customer-layout.component').then(
        (component) => component.CustomerLayoutComponent,
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./features/home/home-page.component').then(
            (component) => component.HomePageComponent,
          ),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./features/products/products-page.component').then(
            (component) => component.ProductsPageComponent,
          ),
      },
      {
        path: 'booking',
        loadComponent: () =>
          import('./features/booking/booking-page.component').then(
            (component) => component.BookingPageComponent,
          ),
      },
      {
        path: 'pets',
        loadComponent: () =>
          import('./features/pets/pets-page.component').then(
            (component) => component.PetsPageComponent,
          ),
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./features/orders/orders-page.component').then(
            (component) => component.OrdersPageComponent,
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];

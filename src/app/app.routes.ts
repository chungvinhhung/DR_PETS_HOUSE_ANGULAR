import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'admin',
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

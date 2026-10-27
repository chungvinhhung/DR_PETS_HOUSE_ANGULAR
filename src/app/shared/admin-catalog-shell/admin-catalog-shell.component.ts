import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { AdminToastService } from '../services/admin-toast.service';
import { RouterLink } from '@angular/router';
import { signal } from '@angular/core';
import { AdminOrderApiService } from '../../features/admin/orders/services/admin-order-api.service';
import { AuthSessionService } from '../../core/services/auth-session.service';

/**
 * Shared Admin catalog chrome for Category and Product screens.
 * Render the header/sidebar once here so switching routes keeps pixel-identical
 * dimensions, image rendering and navigation placement.
 */
@Component({
  selector: 'app-admin-catalog-shell',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-catalog-shell.component.html',
  styleUrl: './admin-catalog-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCatalogShellComponent {
  readonly toast = inject(AdminToastService);
  private readonly orderApi = inject(AdminOrderApiService);
  private readonly session = inject(AuthSessionService);
  readonly pendingReturnCount = signal(0);
  @Input({ required: true }) activeItem!: 'categories' | 'products' | 'orders' | 'vouchers' | 'services' | 'branches' | 'staff' | 'inventory';

  salesExpanded = false;
  servicesExpanded = false;
  operationsExpanded = false;
  contentExpanded = false;
  feedbackExpanded = false;

  ngOnInit(): void {
    if (this.session.hasAnyRole(['ADMIN','MANAGER','STAFF'])) {
      this.orderApi.listReturns().subscribe({
        next: page => this.pendingReturnCount.set(page.items.filter(r => r.status === 'REQUESTED').length),
        error: () => this.pendingReturnCount.set(0),
      });
    }
    this.salesExpanded = this.activeItem === 'categories' || this.activeItem === 'products' || this.activeItem === 'orders' || this.activeItem === 'vouchers';
    this.servicesExpanded = this.activeItem === 'services';
    this.operationsExpanded = this.activeItem === 'branches' || this.activeItem === 'staff' || this.activeItem === 'inventory';
  }

  toggleSales(): void {
    this.salesExpanded = !this.salesExpanded;
  }

  toggleServices(): void {
    this.servicesExpanded = !this.servicesExpanded;
  }

  toggleOperations(): void {
    this.operationsExpanded = !this.operationsExpanded;
  }

  toggleContent(): void {
    this.contentExpanded = !this.contentExpanded;
  }

  toggleFeedback(): void {
    this.feedbackExpanded = !this.feedbackExpanded;
  }
}

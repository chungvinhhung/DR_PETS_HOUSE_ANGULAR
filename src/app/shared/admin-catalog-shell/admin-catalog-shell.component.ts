import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { AdminToastService } from '../services/admin-toast.service';
import { RouterLink } from '@angular/router';
import { AdminReturnNotificationService } from '../services/admin-return-notification.service';

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
  readonly returnNotifications = inject(AdminReturnNotificationService);
  readonly pendingReturnCount = this.returnNotifications.pendingCount;
  @Input({ required: true }) activeItem!: 'categories' | 'products' | 'orders' | 'vouchers' | 'services' | 'branches' | 'staff' | 'inventory';

  /**
   * Sidebar behaves as an accordion: exactly zero or one group can be open.
   * Keep the active route intact even when its parent group is collapsed.
   */
  private expandedGroup: 'sales' | 'services' | 'operations' | 'content' | 'feedback' | null = null;

  get salesExpanded(): boolean { return this.expandedGroup === 'sales'; }
  get servicesExpanded(): boolean { return this.expandedGroup === 'services'; }
  get operationsExpanded(): boolean { return this.expandedGroup === 'operations'; }
  get contentExpanded(): boolean { return this.expandedGroup === 'content'; }
  get feedbackExpanded(): boolean { return this.expandedGroup === 'feedback'; }

  ngOnInit(): void {
    this.returnNotifications.ensureLoaded();
    if (this.activeItem === 'categories' || this.activeItem === 'products' ||
        this.activeItem === 'orders' || this.activeItem === 'vouchers') {
      this.expandedGroup = 'sales';
    } else if (this.activeItem === 'services') {
      this.expandedGroup = 'services';
    } else if (this.activeItem === 'branches' || this.activeItem === 'staff' ||
               this.activeItem === 'inventory') {
      this.expandedGroup = 'operations';
    }
  }

  private toggleGroup(group: NonNullable<typeof this.expandedGroup>): void {
    this.expandedGroup = this.expandedGroup === group ? null : group;
  }

  toggleSales(): void { this.toggleGroup('sales'); }
  toggleServices(): void { this.toggleGroup('services'); }
  toggleOperations(): void { this.toggleGroup('operations'); }
  toggleContent(): void { this.toggleGroup('content'); }
  toggleFeedback(): void { this.toggleGroup('feedback'); }
}

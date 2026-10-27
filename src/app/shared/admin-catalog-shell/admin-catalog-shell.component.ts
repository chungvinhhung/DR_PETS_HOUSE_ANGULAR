import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { AdminToastService } from '../services/admin-toast.service';
import { RouterLink } from '@angular/router';
import { AdminReturnNotificationService } from '../services/admin-return-notification.service';
import { AdminSidebarAccordionService, AdminSidebarGroup } from '../services/admin-sidebar-accordion.service';

/**
 * Shared Admin catalog chrome for category, product and operations screens.
 * The shell itself is rebuilt after navigating between routed child pages,
 * so accordion state lives in AdminSidebarAccordionService across instances.
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
  private readonly accordion = inject(AdminSidebarAccordionService);

  @Input({ required: true }) activeItem!: 'categories' | 'products' | 'orders' | 'vouchers' | 'services' | 'branches' | 'staff' | 'inventory';

  // Animation is intentionally disabled on each newly mounted shell. Route
  // initialization should NEVER replay the previous group's close animation.
  sidebarAnimationEnabled = false;

  get salesExpanded(): boolean { return this.accordion.expandedGroup() === 'sales'; }
  get servicesExpanded(): boolean { return this.accordion.expandedGroup() === 'services'; }
  get operationsExpanded(): boolean { return this.accordion.expandedGroup() === 'operations'; }
  get contentExpanded(): boolean { return this.accordion.expandedGroup() === 'content'; }
  get feedbackExpanded(): boolean { return this.accordion.expandedGroup() === 'feedback'; }

  ngOnInit(): void {
    this.returnNotifications.ensureLoaded();
    const group = this.groupForActiveItem();
    this.accordion.openForRoute(group);
  }

  private groupForActiveItem(): AdminSidebarGroup {
    switch (this.activeItem) {
      case 'categories':
      case 'products':
      case 'orders':
      case 'vouchers':
        return 'sales';
      case 'services':
        return 'services';
      case 'branches':
      case 'staff':
      case 'inventory':
        return 'operations';
    }
  }

  private toggleGroup(group: AdminSidebarGroup): void {
    this.sidebarAnimationEnabled = true;
    this.accordion.toggle(group);
  }

  toggleSales(): void { this.toggleGroup('sales'); }
  toggleServices(): void { this.toggleGroup('services'); }
  toggleOperations(): void { this.toggleGroup('operations'); }
  toggleContent(): void { this.toggleGroup('content'); }
  toggleFeedback(): void { this.toggleGroup('feedback'); }
}

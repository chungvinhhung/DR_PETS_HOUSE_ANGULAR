import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges, computed, inject, signal } from '@angular/core';
import { AdminToastService } from '../services/admin-toast.service';
import { Router, RouterLink } from '@angular/router';
import { HostListener } from '@angular/core';
import { finalize } from 'rxjs';
import { AdminAuthService } from '../../features/admin/auth/services/admin-auth.service';
import { AdminReturnNotificationService } from '../services/admin-return-notification.service';
import { AdminOrderNotificationService } from '../services/admin-order-notification.service';
import { AdminSidebarAccordionService, AdminSidebarGroup } from '../services/admin-sidebar-accordion.service';
import { AdminNotificationService, AdminNotification } from '../services/admin-notification.service';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { AdminCapability, canAdmin } from '../../core/guards/admin-role-policy';

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
export class AdminCatalogShellComponent implements OnChanges {
  readonly toast = inject(AdminToastService);
  readonly returnNotifications = inject(AdminReturnNotificationService);
  readonly pendingReturnCount = this.returnNotifications.pendingCount;
  readonly orderNotifications = inject(AdminOrderNotificationService);
  readonly pendingOrderCount = this.orderNotifications.pendingCount;
  readonly pendingSalesCount = computed(() => this.pendingOrderCount() + this.pendingReturnCount());
  private readonly accordion = inject(AdminSidebarAccordionService);
  readonly notifications = inject(AdminNotificationService);
  readonly session = inject(AuthSessionService);
  private readonly router = inject(Router);
  private readonly adminAuth = inject(AdminAuthService);
  readonly profileMenuOpen = signal(false);
  readonly isLoggingOut = signal(false);
  readonly canViewAccountProfile = computed(() => this.can('profile.view'));
  /** Sidebar visibility follows the same fixed matrix as route guards. */
  can(capability: AdminCapability): boolean { return canAdmin(this.session.user(), capability); }
  readonly landingRoute = computed(() => this.can('dashboard.view') ? '/admin/dashboard'
    : this.can('orders.view') ? '/admin/orders'
    : this.can('records.view') ? '/admin/service-records'
    : '/admin/appointments');
  readonly notificationOpen = signal(false);

  @Input({ required: true }) activeItem!:
    | 'dashboard' | 'categories' | 'products' | 'orders' | 'vouchers'
    | 'services' | 'appointments' | 'service-records'
    | 'branches' | 'staff' | 'inventory' | 'customers'
    | 'content-articles' | 'content-first-aid' | 'content-community' | 'content-rescue'
    | 'moderation-reviews' | 'moderation-feedback' | 'moderation-reports' | 'account-profile';

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
    this.orderNotifications.ensureLoaded();
    this.notifications.ensureLoaded();
    this.syncSidebarToActiveItem();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activeItem'] && !changes['activeItem'].firstChange) {
      this.syncSidebarToActiveItem();
    }
  }

  private syncSidebarToActiveItem(): void {
    this.accordion.openForRoute(this.groupForActiveItem());
  }

  closeSidebarGroups(): void {
    this.sidebarAnimationEnabled = true;
    this.accordion.openForRoute(null);
  }

  private groupForActiveItem(): AdminSidebarGroup | null {
    switch (this.activeItem) {
      case 'categories':
      case 'products':
      case 'orders':
      case 'vouchers':
        return 'sales';
      case 'services':
      case 'appointments':
      case 'service-records':
        return 'services';
      case 'branches':
      case 'staff':
      case 'inventory':
        return 'operations';
      case 'content-articles':
      case 'content-first-aid':
      case 'content-community':
      case 'content-rescue':
        return 'content';
      case 'moderation-reviews':
      case 'moderation-feedback':
      case 'moderation-reports':
        return 'feedback';
      case 'dashboard':
      case 'customers':
      case 'account-profile':
        return null;
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
  toggleNotifications(): void {
    this.notificationOpen.update(open=>!open);
    if(this.notificationOpen())this.notifications.ensureLoaded();
  }
  closeNotifications(): void { this.notificationOpen.set(false); }
  openNotification(item: AdminNotification): void {
    this.notifications.markRead(item.id);
    this.closeNotifications();
  }
  roleLabel(): string {
    const user=this.session.user();
    if(!user)return 'Tài khoản';
    if(user.systemRole==='ADMIN')return 'Quản trị viên';
    if(user.systemRole==='MANAGER')return 'Quản lý';
    if(user.staffSubRole==='VETERINARIAN')return 'Bác sĩ thú y';
    if(user.staffSubRole==='NURSE')return 'Y tá';
    if(user.staffSubRole==='CARE_STAFF_GROOMER')return 'Nhân viên chăm sóc';
    if(user.staffSubRole==='RECEPTIONIST')return 'Lễ tân';
    return user.systemRole;
  }
  toggleProfileMenu(): void {
    this.profileMenuOpen.update(open => !open);
    if (this.profileMenuOpen()) this.closeNotifications();
  }

  closeProfileMenu(): void { this.profileMenuOpen.set(false); }

  @HostListener('document:click', ['$event'])
  closeMenusOnOutside(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (this.profileMenuOpen() && !(target as Element).parentElement?.closest('.catalog-header__profile-wrap')
        && !(target as Element).closest?.('.catalog-header__profile-wrap')) this.closeProfileMenu();
  }

  @HostListener('document:keydown.escape')
  closeMenusOnEscape(): void { this.closeProfileMenu(); }

  logout(): void {
    if (this.isLoggingOut()) return;
    this.closeProfileMenu();
    this.isLoggingOut.set(true);
    this.adminAuth.logout().pipe(finalize(() => this.isLoggingOut.set(false)))
      .subscribe({
        next: () => void this.router.navigateByUrl('/admin/login'),
        error: () => void this.router.navigateByUrl('/admin/login'),
      });
  }

  notificationTime(value:string): string {
    const date=new Date(value);
    if(Number.isNaN(date.getTime()))return '';
    return new Intl.DateTimeFormat('vi-VN',{
      day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,
      timeZone:'Asia/Ho_Chi_Minh',
    }).format(date);
  }

  toggleFeedback(): void { this.toggleGroup('feedback'); }
}

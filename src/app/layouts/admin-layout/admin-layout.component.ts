import {
  ChangeDetectionStrategy,
  Component,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, finalize } from 'rxjs';

import { AuthSessionService } from '../../core/services/auth-session.service';
import { AdminAuthService } from '../../features/admin/auth/services/admin-auth.service';
import { AdminPermissionService } from '../../features/admin/auth/services/admin-permission.service';

type AdminNavGroup = 'sales' | 'services' | 'operations' | 'content' | 'feedback';

/**
 * Admin chrome shared by dashboard, appointments and internal accounts.
 * Figma source: Navigation / Admin Navbar and Navigation / Admin Sidebar (WEB-2).
 * The catalogue shell uses the same tokens and visual conventions.
 */
@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLayoutComponent {
  readonly user = this.authSession.user;
  readonly isLoggingOut = signal(false);
  readonly canViewUsers = this.permissions.canViewUsers;
  readonly activeUrl = signal('');
  readonly expandedGroup = signal<AdminNavGroup | null>(null);
  readonly mobileNavOpen = signal(false);

  constructor(
    private readonly authSession: AuthSessionService,
    private readonly adminAuth: AdminAuthService,
    private readonly permissions: AdminPermissionService,
    private readonly router: Router,
  ) {
    this.activeUrl.set(this.router.url);
    this.expandedGroup.set(this.groupForUrl(this.router.url));
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed(),
    ).subscribe(event => {
      this.activeUrl.set(event.urlAfterRedirects);
      this.expandedGroup.set(this.groupForUrl(event.urlAfterRedirects));
      this.mobileNavOpen.set(false);
    });
  }

  private groupForUrl(url: string): AdminNavGroup | null {
    const pathname = url.split('?')[0].split('#')[0];
    if (/^\/admin\/(categories|products|orders|order-returns|vouchers)(\/|$)/.test(pathname)) return 'sales';
    if (/^\/admin\/(services|appointments)(\/|$)/.test(pathname)) return 'services';
    if (/^\/admin\/(inventory|branches|staff|users)(\/|$)/.test(pathname)) return 'operations';
    return null;
  }

  isActiveGroup(group: AdminNavGroup): boolean {
    return this.groupForUrl(this.activeUrl()) === group;
  }

  isExpanded(group: AdminNavGroup): boolean {
    return this.expandedGroup() === group;
  }

  toggleGroup(group: AdminNavGroup): void {
    this.expandedGroup.update(current => current === group ? null : group);
  }

  logout(): void {
    if (this.isLoggingOut()) return;
    this.isLoggingOut.set(true);
    this.adminAuth.logout()
      .pipe(finalize(() => this.isLoggingOut.set(false)))
      .subscribe({
        next: () => void this.router.navigateByUrl('/admin/login'),
        error: () => void this.router.navigateByUrl('/admin/login'),
      });
  }
}

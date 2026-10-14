import {
  ChangeDetectionStrategy,
  Component,
  signal,
} from '@angular/core';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter, finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AuthSessionService } from '../../core/services/auth-session.service';
import { AdminAuthService } from '../../features/admin/auth/services/admin-auth.service';
import { AdminPermissionService } from '../../features/admin/auth/services/admin-permission.service';

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
  readonly isCatalogLayout = signal(false);
  readonly canViewUsers = this.permissions.canViewUsers;

  constructor(
    private readonly authSession: AuthSessionService,
    private readonly adminAuth: AdminAuthService,
    private readonly permissions: AdminPermissionService,
    private readonly router: Router,
  ) {
    this.isCatalogLayout.set(this.router.url.startsWith('/admin/services'));
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      takeUntilDestroyed(),
    ).subscribe((event) => {
      this.isCatalogLayout.set(event.urlAfterRedirects.startsWith('/admin/services'));
    });
  }

  logout(): void {
    if (this.isLoggingOut()) {
      return;
    }

    this.isLoggingOut.set(true);

    this.adminAuth
      .logout()
      .pipe(finalize(() => this.isLoggingOut.set(false)))
      .subscribe({
        next: () => {
          void this.router.navigateByUrl('/admin/login');
        },
        error: () => {
          void this.router.navigateByUrl('/admin/login');
        },
      });
  }
}

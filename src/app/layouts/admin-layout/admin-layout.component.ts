import {
  ChangeDetectionStrategy,
  Component,
  signal,
} from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { finalize } from 'rxjs';

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
  readonly canViewUsers = this.permissions.canViewUsers;

  constructor(
    private readonly authSession: AuthSessionService,
    private readonly adminAuth: AdminAuthService,
    private readonly permissions: AdminPermissionService,
    private readonly router: Router,
  ) {}

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

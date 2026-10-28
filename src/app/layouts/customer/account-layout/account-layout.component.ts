import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { NavBarComponent } from '../components/navbar/nav-bar.component';
import { SidebarComponent } from '../components/sidebar/sidebar.component';
import { FooterComponent } from '../components/footer/footer.component';

/**
 * AccountLayout — chuyển từ React: src/layout/LayoutManagePet.jsx (component LayoutManagePet)
 */
@Component({
  selector: 'div[app-account-layout]',
  standalone: true,
  imports: [RouterOutlet, NavBarComponent, SidebarComponent, FooterComponent],
  templateUrl: './account-layout.component.html',
  host: {
    'class': 'fixed inset-0 flex flex-col overflow-hidden bg-white w-full h-full',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountLayoutComponent {
}

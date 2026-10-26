import { ChangeDetectionStrategy, Component } from '@angular/core';

import { CanvasLayoutComponent } from '../../../../shared/customer/components/canvas-layout/canvas-layout.component';
import { NavBarComponent } from '../../../../layouts/customer/components/navbar/nav-bar.component';
import { ContactChannelComponent } from './contact-channel.component';
import { ContactFormComponent } from './contact-form.component';
import { BranchDirectoryComponent } from './branch-directory.component';
import { FooterComponent } from '../../../../layouts/customer/components/footer/footer.component';
import { CONTACT_CHANNELS } from '../data/contact-data';

/**
 * ContactPage — chuyển từ React: src/pages/Contact/ContactPage.jsx
 */
@Component({
  selector: 'div[app-contact-page]',
  standalone: true,
  imports: [CanvasLayoutComponent, NavBarComponent, ContactChannelComponent, ContactFormComponent, BranchDirectoryComponent, FooterComponent],
  templateUrl: './contact-page.component.html',
  host: {
    'class': 'contact-page',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactPageComponent {
  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly CONTACT_CHANNELS: any = CONTACT_CHANNELS;

}

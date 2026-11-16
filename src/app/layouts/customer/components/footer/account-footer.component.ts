import { ChangeDetectionStrategy, Component } from '@angular/core';

import { CustomerLinkDirective } from '../../../../shared/customer/directives/customer-link.directive';
import { LEGAL_LINKS } from './footer.helpers';

/**
 * AccountFooter — chuyển từ React: src/components/Footer/Footer.jsx
 */
@Component({
  selector: 'footer[app-account-footer]',
  standalone: true,
  imports: [CustomerLinkDirective],
  templateUrl: './account-footer.component.html',
  styleUrl: './account-footer.component.scss',
  host: {
    'class': 'flex h-[36px] w-full shrink-0 items-center justify-center overflow-hidden bg-[#B3E5FC] px-4 font-sans md:h-auto md:items-start md:justify-between md:px-8 md:py-[18px] lg:h-[36px] lg:items-center lg:justify-center lg:px-12 lg:py-0',
    'data-footer-variant': 'account',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountFooterComponent {
  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly LEGAL_LINKS: any = LEGAL_LINKS;

}

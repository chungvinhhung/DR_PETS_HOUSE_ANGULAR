import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { TabletSocialLinksComponent } from './tablet-social-links.component';
import { TabletContactRowComponent } from './tablet-contact-row.component';
import { TabletFooterColumnComponent } from './tablet-footer-column.component';
import { CustomerLinkDirective } from '../../../../shared/customer/directives/customer-link.directive';
import { homeImages } from '../../../../shared/customer/assets/home-images';
import { QUICK_LINKS, SERVICE_LINKS, SUPPORT_LINKS, LEGAL_LINKS, GENERAL_LINKS } from './footer.helpers';

/**
 * TabletFooter — chuyển từ React: src/components/Footer/Footer.jsx
 */
@Component({
  selector: 'footer[app-tablet-footer]',
  standalone: true,
  imports: [TabletSocialLinksComponent, TabletContactRowComponent, TabletFooterColumnComponent, CustomerLinkDirective],
  templateUrl: './tablet-footer.component.html',
  styleUrl: './tablet-footer.component.scss',
  host: {
    '[class]': '`hidden w-full flex-col items-start overflow-hidden font-sans md:flex lg:hidden ${ isBlue() ? \'bg-[#E4F5FC]\' : \'bg-white\' }`',
    'data-footer-tablet': 'true',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabletFooterComponent {
  // --- Input / Output (props của React) ---
  readonly isBlue = input<any>(undefined);
  readonly onPricingOpen = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly homeImages: any = homeImages;
  protected readonly QUICK_LINKS: any = QUICK_LINKS;
  protected readonly SERVICE_LINKS: any = SERVICE_LINKS;
  protected readonly GENERAL_LINKS: any = GENERAL_LINKS;
  protected readonly SUPPORT_LINKS: any = SUPPORT_LINKS;
  protected readonly LEGAL_LINKS: any = LEGAL_LINKS;

}

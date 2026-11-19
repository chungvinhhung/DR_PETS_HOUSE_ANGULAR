import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { MobileFooterSectionComponent } from './mobile-footer-section.component';
import { MobileSocialLinksComponent } from './mobile-social-links.component';
import { CustomerLinkDirective } from '../../../../shared/customer/directives/customer-link.directive';
import { homeImages } from '../../../../shared/customer/assets/home-images';
import { QUICK_LINKS, SERVICE_LINKS, MOBILE_SUPPORT_LINKS } from './footer.helpers';

/**
 * MobileFooter — chuyển từ React: src/components/Footer/Footer.jsx
 */
@Component({
  selector: 'footer[app-mobile-footer]',
  standalone: true,
  imports: [MobileFooterSectionComponent, MobileSocialLinksComponent, CustomerLinkDirective],
  templateUrl: './mobile-footer.component.html',
  styleUrl: './mobile-footer.component.scss',
  host: {
    '[class]': '`relative flex w-full flex-col items-start px-5 pb-[35px] pt-5 font-sans md:hidden ${ isBlue() ? \'bg-[#E5F6FD]\' : \'bg-white\' }`',
    'data-footer-mobile': 'true',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileFooterComponent {
  // --- Input / Output (props của React) ---
  readonly isBlue = input<any>(undefined);
  readonly onPricingOpen = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly homeImages: any = homeImages;

  // --- Giá trị tính toán (computed) ---
  readonly sections = computed<any>(() => [
    { id: "quick", title: "Liên kết nhanh", links: QUICK_LINKS },
    { id: "services", title: "Dịch vụ nổi bật", links: SERVICE_LINKS },
    {
      id: "general",
      title: "Thông tin chung",
      links: [
        ["Về chúng tôi", "/about"],
        ["Liên hệ", "/contact"],
        ["Danh sách chi nhánh", "/contact"],
      ],
    },
    { id: "support", title: "Hỗ trợ khách hàng", links: MOBILE_SUPPORT_LINKS },
  ]);

  // --- Trạng thái (signal = useState / useRef) ---
  readonly openSection = signal<any>("");

  protected handle1(section: any) {
    this.openSection.update((current: any) => (current === section.id ? "" : section.id));
  }
}

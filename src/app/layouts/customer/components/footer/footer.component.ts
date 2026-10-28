import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, signal, untracked, viewChild } from '@angular/core';

import { AccountFooterComponent } from './account-footer.component';
import { MobileFooterComponent } from './mobile-footer.component';
import { TabletFooterComponent } from './tablet-footer.component';
import { FooterColumnComponent } from './footer-column.component';
import { FooterLinkComponent } from './footer-link.component';
import { ServicePricingModalComponent } from '../../../../features/customer/clinic-services/components/service-pricing-modal/service-pricing-modal.component';
import { CustomerLinkDirective } from '../../../../shared/customer/directives/customer-link.directive';
import { homeImages } from '../../../../shared/customer/assets/home-images';
import { QUICK_LINKS, SERVICE_LINKS, SUPPORT_LINKS, LEGAL_LINKS, isBlueBackground } from './footer.helpers';

/**
 * Footer — chuyển từ React: src/components/Footer/Footer.jsx
 */
@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [AccountFooterComponent, MobileFooterComponent, TabletFooterComponent, FooterColumnComponent, FooterLinkComponent, ServicePricingModalComponent, CustomerLinkDirective],
  templateUrl: './footer.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FooterComponent {
  // --- Input / Output (props của React) ---
  readonly variant = input<any>("auto");

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly homeImages: any = homeImages;
  protected readonly QUICK_LINKS: any = QUICK_LINKS;
  protected readonly SERVICE_LINKS: any = SERVICE_LINKS;
  protected readonly SUPPORT_LINKS: any = SUPPORT_LINKS;
  protected readonly LEGAL_LINKS: any = LEGAL_LINKS;

  // --- Giá trị tính toán (computed) ---
  readonly resolvedVariant = computed<any>(() => this.variant() === "auto" ? this.autoVariant() : this.variant());
  readonly isBlue = computed<any>(() => this.resolvedVariant() === "blue");

  // --- Trạng thái (signal = useState / useRef) ---
  readonly autoVariant = signal<any>("blue");
  readonly isPricingOpen = signal<any>(false);
  readonly footerRef = viewChild<ElementRef<any>>('footerRef');

  constructor() {
    // useEffect(..., [variant])
    effect((onCleanup: any) => {
      this.variant();
      const cleanup = untracked(() => {
        if (this.variant() !== "auto" || !this.footerRef()?.nativeElement) return undefined;

        const footer = this.footerRef()?.nativeElement;
        const updateVariant = () => {
          this.autoVariant.set(isBlueBackground(footer.previousElementSibling) ? "white" : "blue");
        };

        updateVariant();
        const observer = new MutationObserver(updateVariant);
        observer.observe(document.body, { attributes: true, subtree: true });
        return () => observer.disconnect();
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });
  }

}

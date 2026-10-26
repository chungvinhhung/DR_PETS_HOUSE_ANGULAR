import { ChangeDetectionStrategy, Component, effect, input, output, signal, untracked } from '@angular/core';

import { CustomerIconComponent } from '../../../../shared/customer/components/icon/customer-icon.component';
import { CustomerLinkDirective } from '../../../../shared/customer/directives/customer-link.directive';
import { homeImages } from '../../../../shared/customer/assets/home-images';
import { NAV_LINKS } from '../../constants/navbar-menu-links';

/**
 * MobileMenuPanel — chuyển từ React: src/components/Navbar/MobileNavBar.jsx
 */
@Component({
  selector: 'app-mobile-menu-panel',
  standalone: true,
  imports: [CustomerIconComponent, CustomerLinkDirective],
  templateUrl: './mobile-menu-panel.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileMenuPanelComponent {
  // --- Input / Output (props của React) ---
  readonly open = input<any>(undefined);
  readonly onClose = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly homeImages: any = homeImages;
  protected readonly NAV_LINKS: any = NAV_LINKS;

  // --- Trạng thái (signal = useState / useRef) ---
  readonly expanded = signal<any>((() => new Set<any>())());

  constructor() {
    // useEffect(..., [onClose, open])
    effect((onCleanup: any) => {
      this.open();
      const cleanup = untracked(() => {
        if (!this.open()) return undefined;
        const handleKeyDown = (event: any) => {
          if (event.key === "Escape") this.onClose.emit(undefined);
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });
  }

  protected toggleSection(label: any) {
    this.expanded.update((current: any) => {
      const next = new Set<any>(current);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  protected handle1(item: any) {
    if (!item.children) this.onClose.emit(undefined);
  }
}

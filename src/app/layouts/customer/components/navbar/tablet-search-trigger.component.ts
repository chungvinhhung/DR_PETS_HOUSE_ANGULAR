import { ChangeDetectionStrategy, Component, output } from '@angular/core';

import { SearchAssetIconComponent } from './search-asset-icon.component';
import { navbarImages } from '../../../../shared/customer/assets/navbar-images';

/**
 * TabletSearchTrigger — chuyển từ React: src/components/Navbar/MobileNavBar.jsx
 */
@Component({
  selector: 'button[app-tablet-search-trigger]',
  standalone: true,
  imports: [SearchAssetIconComponent],
  templateUrl: './tablet-search-trigger.component.html',
  host: {
    'type': 'button',
    '(click)': 'onOpen.emit($event)',
    'class': 'relative hidden h-[37px] w-[204px] shrink-0 overflow-hidden rounded border border-[#FDD835] bg-white text-left md:block lg:hidden',
    'aria-label': 'Mở tìm kiếm',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TabletSearchTriggerComponent {
  // --- Input / Output (props của React) ---
  readonly onOpen = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly navbarImages: any = navbarImages;

}

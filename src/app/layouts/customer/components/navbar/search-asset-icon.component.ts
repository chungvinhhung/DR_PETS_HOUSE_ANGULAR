import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { navbarImages } from '../../../../shared/customer/assets/navbar-images';

/**
 * SearchAssetIcon — chuyển từ React: src/components/Navbar/MobileNavBar.jsx
 */
@Component({
  selector: 'img[app-search-asset-icon]',
  standalone: true,
  imports: [],
  templateUrl: './search-asset-icon.component.html',
  styleUrl: './search-asset-icon.component.scss',
  host: {
    '[attr.src]': 'navbarImages.searchIcon',
    'alt': '',
    '[class]': 'className()',
    'aria-hidden': 'true',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchAssetIconComponent {
  // --- Input / Output (props của React) ---
  readonly className = input<any>("size-[18px]");

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly navbarImages: any = navbarImages;

}

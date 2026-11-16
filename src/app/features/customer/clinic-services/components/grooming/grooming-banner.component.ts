import { ChangeDetectionStrategy, Component, output } from '@angular/core';

import { ReactStyleDirective } from '../../../../../shared/customer/directives/react-style.directive';
import { CustomerLinkDirective } from '../../../../../shared/customer/directives/customer-link.directive';
import { medicalAssets } from '../../data/medical-treatment-data';

/**
 * GroomingBanner — chuyển từ React: src/components/groomingSpa/GroomingBanner.jsx
 */
@Component({
  selector: 'section[app-grooming-banner]',
  standalone: true,
  imports: [ReactStyleDirective, CustomerLinkDirective],
  templateUrl: './grooming-banner.component.html',
  styleUrl: './grooming-banner.component.scss',
  host: {
    'class': 'relative flex h-[239px] w-full flex-col items-center justify-center overflow-hidden pb-[25px]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroomingBannerComponent {
  // --- Input / Output (props của React) ---
  readonly onOpenPricing = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly medicalAssets: any = medicalAssets;

}

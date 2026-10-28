import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { homeImages } from '../../../../shared/customer/assets/home-images';

/**
 * DoctorCard — chuyển từ React: src/components/home/DoctorSection.jsx
 */
@Component({
  selector: 'article[app-doctor-card]',
  standalone: true,
  imports: [],
  templateUrl: './doctor-card.component.html',
  host: {
    'class': 'relative flex h-[330px] w-full items-end justify-center',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoctorCardComponent {
  // --- Input / Output (props của React) ---
  readonly image = input<any>(undefined);
  readonly name = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly homeImages: any = homeImages;

}

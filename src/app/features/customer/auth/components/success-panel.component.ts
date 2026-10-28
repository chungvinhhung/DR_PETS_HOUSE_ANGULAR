import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { CustomerIconComponent } from '../../../../shared/customer/components/icon/customer-icon.component';
import { authImages } from '../../../../shared/customer/assets/auth-images';

/**
 * SuccessPanel — chuyển từ React: src/components/auth/AuthModal.jsx
 */
@Component({
  selector: 'div[app-success-panel]',
  standalone: true,
  imports: [CustomerIconComponent],
  templateUrl: './success-panel.component.html',
  host: {
    'class': 'relative flex min-h-[646px] w-full flex-col items-center overflow-hidden rounded-xl rounded-bl-none bg-white pb-[15px] pt-[67px] shadow-2xl md:min-h-[560px] md:flex-row md:justify-center md:gap-10 md:rounded-bl-xl md:p-10',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuccessPanelComponent {
  // --- Input / Output (props của React) ---
  readonly changeScreen = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly authImages: any = authImages;

}

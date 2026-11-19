import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { AuthBackgroundBlobComponent } from './auth-background-blob.component';
import { authImages } from '../../../../shared/customer/assets/auth-images';
import { SIDE_CONTENT } from './auth-modal.helpers';

/**
 * SplitSide — chuyển từ React: src/components/auth/AuthModal.jsx
 */
@Component({
  selector: 'aside[app-split-side]',
  standalone: true,
  imports: [AuthBackgroundBlobComponent],
  templateUrl: './split-side.component.html',
  styleUrl: './split-side.component.scss',
  host: {
    'class': 'relative flex h-[242px] w-full shrink-0 flex-col items-center justify-center overflow-hidden bg-[#90CAF9] px-5 text-center md:h-auto md:w-1/2 md:self-stretch md:px-8 lg:w-[48%]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SplitSideComponent {
  // --- Input / Output (props của React) ---
  readonly variant = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly authImages: any = authImages;

  // --- Giá trị tính toán (computed) ---
  readonly content = computed<any>(() => (SIDE_CONTENT as any)[this.variant()]);

}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { authImages } from '../../../../shared/customer/assets/auth-images';

/**
 * AuthBackgroundBlob — chuyển từ React: src/components/auth/AuthModal.jsx
 */
@Component({
  selector: 'img[app-auth-background-blob]',
  standalone: true,
  imports: [],
  templateUrl: './auth-background-blob.component.html',
  host: {
    '[attr.src]': 'authImages.backgroundBlob',
    'alt': '',
    'aria-hidden': 'true',
    '[class]': '`pointer-events-none absolute max-w-none select-none ${className()}`',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthBackgroundBlobComponent {
  // --- Input / Output (props của React) ---
  readonly className = input<any>("");

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly authImages: any = authImages;

}

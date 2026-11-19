import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { CustomerIconComponent } from '../../../../../shared/customer/components/icon/customer-icon.component';
import { CustomerLinkDirective } from '../../../../../shared/customer/directives/customer-link.directive';
import { getFirstAidFallbackImage } from '../../../../../shared/customer/data/first-aid-data';

/**
 * FirstAidCard — chuyển từ React: src/pages/Blog/FirstAidPage.jsx
 */
@Component({
  selector: 'app-first-aid-card',
  standalone: true,
  imports: [CustomerIconComponent, CustomerLinkDirective],
  templateUrl: './first-aid-card.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FirstAidCardComponent {
  // --- Input / Output (props của React) ---
  readonly post = input<any>(undefined);

  // --- Giá trị tính toán (computed) ---
  readonly isUrgent = computed<any>(() => this.post().variant === "urgent");
  readonly hasImage = computed<any>(() => Boolean(this.post()?.image));
  readonly fallbackImage = computed(() => getFirstAidFallbackImage(String(this.post()?.category || '')));
  readonly displayImage = computed(() => {
    const image = String(this.post()?.image || '').trim();
    // Both old placeholder paths were checked-in checkerboard artwork.
    if (!image || image.includes('/blog/post-placeholder.png') ||
        image.includes('/blog/first-aid-choking.png')) {
      return this.fallbackImage();
    }
    return image;
  });

  onImageError(event: Event): void {
    const image = event.target as HTMLImageElement | null;
    if (!image) return;
    const fallback = this.fallbackImage();
    if (image.getAttribute('src') !== fallback) image.src = fallback;
  }
}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * HeroSlideLayer — chuyển từ React: src/components/shop/ShopHeroSection.jsx
 */
@Component({
  selector: 'div[app-hero-slide-layer]',
  standalone: true,
  imports: [],
  templateUrl: './hero-slide-layer.component.html',
  styleUrl: './hero-slide-layer.component.scss',
  host: {
    '[class]': '`absolute inset-0 size-full transition-opacity duration-[700ms] ease-in-out ${ isActive() ? \'opacity-100\' : \'pointer-events-none opacity-0\' }`',
    '[attr.aria-hidden]': '!isActive()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroSlideLayerComponent {
  // --- Input / Output (props của React) ---
  readonly slide = input<any>(undefined);
  readonly isActive = input<any>(undefined);

}

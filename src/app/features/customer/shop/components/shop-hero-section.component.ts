import { ChangeDetectionStrategy, Component, effect, inject, signal, untracked } from '@angular/core';

import { CustomerNavigationService } from '../../../../core/customer/services/customer-navigation.service';
import { HeroSlideLayerComponent } from './hero-slide-layer.component';
import { ReactStyleDirective } from '../../../../shared/customer/directives/react-style.directive';
import { useCarouselKeyboard } from '../../../../shared/customer/utils/carousel-keyboard';
import { AUTO_PLAY_MS, SLIDE_COUNT, INDICATOR_ACTIVE_WIDTH, INDICATOR_INACTIVE_WIDTH, HERO_SLIDES, FLOWER_ICON } from './shop-hero-section.helpers';

/**
 * ShopHeroSection — chuyển từ React: src/components/shop/ShopHeroSection.jsx
 */
@Component({
  selector: 'section[app-shop-hero-section]',
  standalone: true,
  imports: [HeroSlideLayerComponent, ReactStyleDirective],
  templateUrl: './shop-hero-section.component.html',
  styleUrl: './shop-hero-section.component.scss',
  host: {
    'class': 'absolute left-0 top-[13px] w-[1440px] px-[30px] pt-0',
    'aria-label': 'Hero',
    'aria-roledescription': 'carousel',
    '(mouseenter)': 'isPaused.set(true)',
    '(mouseleave)': 'isPaused.set(false)',
    '(touchstart)': 'handleTouchStart($any($event))',
    '(touchend)': 'handleTouchEnd($any($event))',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopHeroSectionComponent {
  // --- Service dùng chung ---
  protected readonly navService = inject(CustomerNavigationService);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly HERO_SLIDES: any = HERO_SLIDES;
  protected readonly FLOWER_ICON: any = FLOWER_ICON;
  protected readonly INDICATOR_ACTIVE_WIDTH: any = INDICATOR_ACTIVE_WIDTH;
  protected readonly INDICATOR_INACTIVE_WIDTH: any = INDICATOR_INACTIVE_WIDTH;

  // --- Trạng thái (signal = useState / useRef) ---
  readonly activeIndex = signal<any>(0);
  readonly isPaused = signal<any>(false);
  readonly touchStartX: { current: any } = { current: null };

  constructor() {
    // useCarouselKeyboard(...) -> phím mũi tên điều khiển carousel
    useCarouselKeyboard(() => ({ onPrev: this.goPrev.bind(this), onNext: this.goNext.bind(this), enabled: !this.isPaused() }));

    // useEffect(..., [goNext, isPaused])
    effect((onCleanup: any) => {
      this.isPaused();
      const cleanup = untracked(() => {
        if (this.isPaused()) {
          return undefined;
        }

        const timer = window.setInterval(this.goNext.bind(this), AUTO_PLAY_MS);
        return () => window.clearInterval(timer);
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });
  }

  protected goToSlide(index: any) {
    this.activeIndex.set(index % SLIDE_COUNT);
  }

  protected goNext() {
    this.activeIndex.update((prev: any) => (prev + 1) % SLIDE_COUNT);
  }

  protected goPrev() {
    this.activeIndex.update((prev: any) => (prev - 1 + SLIDE_COUNT) % SLIDE_COUNT);
  }

  protected handleTouchStart(event: any) {
    this.touchStartX.current = event.touches[0]?.clientX ?? null;
  }

  protected handleTouchEnd(event: any) {
    if (this.touchStartX.current == null) return;
    const endX = event.changedTouches[0]?.clientX ?? this.touchStartX.current;
    const delta = endX - this.touchStartX.current;
    if (Math.abs(delta) > 48) {
      if (delta < 0) this.goNext();
      else this.goPrev();
    }
    this.touchStartX.current = null;
  }

  protected handle1() {
    this.navService.navigate('/products');
  }

  /** (tự sinh) Array.from(...) -> mảng để lặp bằng @for */
  protected range2(): any[] {
    return (Array.from({ length: SLIDE_COUNT }) as any);
  }
}

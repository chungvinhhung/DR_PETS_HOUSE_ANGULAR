import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked } from '@angular/core';

import { FeedbackCardComponent } from './feedback-card.component';
import { FeedbackDotComponent } from './feedback-dot.component';
import { ReactStyleDirective } from '../../directives/react-style.directive';
import { shopImages } from '../../assets/shop-images';
import { FEEDBACK_PAGE_COUNT, FEEDBACK_PAGES } from '../../data/feedback-data';
import { SECTION_TITLE_TYPOGRAPHY } from './feedback-section.helpers';

/**
 * FeedbackSection — chuyển từ React: src/components/shop/FeedbackSection.jsx
 *
 * Ghi chú chuyển đổi:
 */
@Component({
  selector: 'section[app-feedback-section]',
  standalone: true,
  imports: [FeedbackCardComponent, FeedbackDotComponent, ReactStyleDirective],
  templateUrl: './feedback-section.component.html',
  host: {
    '[class]': 'layout() === \'flow\' ? \'relative mx-auto h-[683px] w-full max-w-[1440px] overflow-hidden\' : \'absolute left-0 top-[calc(2637px+0.5cm)] h-[683px] w-[1440px] overflow-hidden\'',
    'aria-label': 'Phản hồi của khách hàng',
    'aria-roledescription': 'carousel',
    'tabindex': '0',
    '(keydown)': 'handleKeyDown($any($event))',
    '(touchstart)': 'handleTouchStart($any($event))',
    '(touchend)': 'handleTouchEnd($any($event))',
    '(mouseenter)': 'handleMouseEnter()',
    '(mouseleave)': 'handleMouseLeave()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedbackSectionComponent {
  // --- Input / Output (props của React) ---
  readonly onMouseEnter = output<any>();
  readonly onMouseLeave = output<any>();
  /** true khi cha truyền (onMouseLeave) — React: if (resumeRef.current) */
  readonly hasOnMouseLeave = input<boolean>(false);
  readonly layout = input<any>("absolute");

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly shopImages: any = shopImages;
  protected readonly FEEDBACK_PAGE_COUNT: any = FEEDBACK_PAGE_COUNT;
  protected readonly FEEDBACK_PAGES: any = FEEDBACK_PAGES;

  // --- Giá trị tính toán (computed) ---
  readonly slideOffset = computed<any>(() => this.direction() === 0 ? "translate-x-0" : this.direction() > 0 ? "animate-feedback-in-next" : "animate-feedback-in-prev");

  // --- Trạng thái (signal = useState / useRef) ---
  readonly pageIndex = signal<any>(0);
  readonly direction = signal<any>(0);
  readonly touchStartX: { current: any } = { current: null };
  readonly autoTimerRef: { current: any } = { current: null };
  readonly pauseRef: { current: any } = { current: null };
  readonly resumeRef: { current: any } = { current: null };

  constructor() {
    // useEffect(..., [startAutoSlide])
    effect((onCleanup: any) => {
      const cleanup = untracked(() => {
        this.startAutoSlide();
        return () => clearInterval(this.autoTimerRef.current);
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });
  }

  protected goPrev() {
    this.direction.set(-1);
    this.pageIndex.update((prev: any) => (prev - 1 + FEEDBACK_PAGE_COUNT) % FEEDBACK_PAGE_COUNT);
  }

  protected goNext() {
    this.direction.set(1);
    this.pageIndex.update((prev: any) => (prev + 1) % FEEDBACK_PAGE_COUNT);
  }

  protected goToPage(index: any) {
    this.pageIndex.update((prev: any) => {
      if (index === prev) return prev;
      const forward =
        index > prev
          ? index - prev
          : index + FEEDBACK_PAGE_COUNT - prev;
      this.direction.set(forward <= FEEDBACK_PAGE_COUNT / 2 ? 1 : -1);
      return index;
    });
  }

  protected handleKeyDown(event: any) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      this.goPrev();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      this.goNext();
    } else if (event.key === "Home") {
      event.preventDefault();
      this.direction.set(-1);
      this.pageIndex.set(0);
    } else if (event.key === "End") {
      event.preventDefault();
      this.direction.set(1);
      this.pageIndex.set(FEEDBACK_PAGE_COUNT - 1);
    }
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

  protected startAutoSlide() {
    clearInterval(this.autoTimerRef.current);
    this.autoTimerRef.current = setInterval(() => {
      this.direction.set(1);
      this.pageIndex.update((prev: any) => (prev + 1) % FEEDBACK_PAGE_COUNT);
    }, 5000);
  }

  protected handleMouseEnter() {
    clearInterval(this.autoTimerRef.current);
    this.onMouseEnter.emit(undefined);
  }

  protected handleMouseLeave() {
    if (this.hasOnMouseLeave()) this.onMouseLeave.emit(undefined);
    else this.startAutoSlide();
  }

  /** (tự sinh) SpreadElement không dùng trực tiếp được trong template */
  protected styles1(): any {
    return { ...SECTION_TITLE_TYPOGRAPHY };
  }

  /** (tự sinh) Array.from(...) -> mảng để lặp bằng @for */
  protected range2(): any[] {
    return (Array.from({ length: FEEDBACK_PAGE_COUNT }) as any);
  }
}

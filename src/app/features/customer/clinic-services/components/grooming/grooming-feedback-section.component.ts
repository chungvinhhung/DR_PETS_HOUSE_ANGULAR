import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

import { GroomingFeedbackSectionFeedbackCardComponent } from './grooming-feedback-section-feedback-card.component';
import { GroomingFeedbackSectionFeedbackDotComponent } from './grooming-feedback-section-feedback-dot.component';
import { ReactStyleDirective } from '../../../../../shared/customer/directives/react-style.directive';
import { groomingFeedbackAssets } from '../../../../../shared/customer/assets/grooming-images';
import { FEEDBACK_PAGE_COUNT, FEEDBACK_PAGES } from '../../../../../shared/customer/data/feedback-data';
import { groomingTitleStyles } from '../../utils/grooming-title-styles';

/**
 * GroomingFeedbackSection — chuyển từ React: src/components/groomingSpa/GroomingFeedbackSection.jsx
 */
@Component({
  selector: 'section[app-grooming-feedback-section]',
  standalone: true,
  imports: [GroomingFeedbackSectionFeedbackCardComponent, GroomingFeedbackSectionFeedbackDotComponent, ReactStyleDirective],
  templateUrl: './grooming-feedback-section.component.html',
  host: {
    'class': 'relative h-[683px] w-full overflow-hidden',
    'aria-label': 'Phản hồi của khách hàng',
    'aria-roledescription': 'carousel',
    'tabindex': '0',
    '(keydown)': 'handleKeyDown($any($event))',
    '(touchstart)': 'handleTouchStart($any($event))',
    '(touchend)': 'handleTouchEnd($any($event))',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroomingFeedbackSectionComponent {
  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly groomingFeedbackAssets: any = groomingFeedbackAssets;
  protected readonly groomingTitleStyles: any = groomingTitleStyles;
  protected readonly FEEDBACK_PAGE_COUNT: any = FEEDBACK_PAGE_COUNT;
  protected readonly FEEDBACK_PAGES: any = FEEDBACK_PAGES;

  // --- Giá trị tính toán (computed) ---
  readonly slideOffset = computed<any>(() => this.direction() === 0
      ? "translate-x-0"
      : this.direction() > 0
        ? "animate-feedback-in-next"
        : "animate-feedback-in-prev");

  // --- Trạng thái (signal = useState / useRef) ---
  readonly pageIndex = signal<any>(0);
  readonly direction = signal<any>(0);
  readonly touchStartX: { current: any } = { current: null };

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
        index > prev ? index - prev : index + FEEDBACK_PAGE_COUNT - prev;
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

  /** (tự sinh) Array.from(...) -> mảng để lặp bằng @for */
  protected range1(): any[] {
    return (Array.from({ length: FEEDBACK_PAGE_COUNT }) as any);
  }
}

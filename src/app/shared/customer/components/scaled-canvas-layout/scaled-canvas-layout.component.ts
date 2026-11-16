import { NgStyle } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

import { computeCanvasScale } from '../../utils/canvas-scale';

/**
 * ScaledCanvasLayout — chuyển từ React: src/components/layout/ScaledCanvasLayout.jsx
 *
 * Thiết kế Figma rộng 1440px. Trên màn hình laptop nhỏ hơn, toàn bộ nội dung được thu nhỏ
 * (transform: scale) để vừa chiều ngang mà vẫn giữ đúng tỉ lệ; màn hình lớn thì giữ nguyên 100%.
 *
 *   <div app-scaled-canvas-layout className="bg-white"> ...nội dung trang... </div>
 */
@Component({
  selector: 'div[app-scaled-canvas-layout]',
  standalone: true,
  imports: [NgStyle],
  templateUrl: './scaled-canvas-layout.component.html',
  styleUrl: './scaled-canvas-layout.component.scss',
  host: { class: 'w-full overflow-x-hidden bg-[#f5f5f5]' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScaledCanvasLayoutComponent {
  readonly className = input<string>('');
  readonly designWidth = input<number>(1440);

  protected readonly scale = signal(1);
  protected readonly scaledHeight = signal<number | null>(null);
  private readonly inner = viewChild<ElementRef<HTMLElement>>('innerRef');

  constructor() {
    const destroyRef = inject(DestroyRef);
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => {
      // Đo chiều rộng thật của khung chứa (không tính thanh cuộn) để canvas luôn vừa khít khi zoom / đổi kích thước.
      const updateScale = () => {
        this.scale.set(computeCanvasScale(host.clientWidth || window.innerWidth, this.designWidth(), 0));
        measure();
      };
      const measure = () => {
        const node = this.inner()?.nativeElement;
        if (node) this.scaledHeight.set(node.offsetHeight * this.scale());
      };
      updateScale();
      window.addEventListener('resize', updateScale);
      const observer = new ResizeObserver(measure);
      const node = this.inner()?.nativeElement;
      if (node) observer.observe(node);
      const hostObserver = new ResizeObserver(updateScale);
      hostObserver.observe(host);
      destroyRef.onDestroy(() => {
        window.removeEventListener('resize', updateScale);
        observer.disconnect();
        hostObserver.disconnect();
      });
    });
  }
}

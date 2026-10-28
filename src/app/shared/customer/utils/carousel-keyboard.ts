import { effect } from '@angular/core';

export interface CarouselKeyboardOptions {
  onPrev: () => void;
  onNext: () => void;
  enabled?: boolean;
}

/**
 * Điều khiển carousel bằng phím mũi tên ← → (thay cho hooks/useCarouselKeyboard.js).
 *
 * Gọi trong constructor của component:
 *   useCarouselKeyboard(() => ({ onPrev: () => this.goPrev(), onNext: () => this.goNext(), enabled: !this.isPaused() }));
 * Hàm truyền vào được đọc lại mỗi khi các signal bên trong thay đổi (vd. enabled).
 */
export function useCarouselKeyboard(getOptions: () => CarouselKeyboardOptions): void {
  effect((onCleanup) => {
    const { onPrev, onNext, enabled = true } = getOptions();
    if (!enabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onPrev();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        onNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    onCleanup(() => window.removeEventListener('keydown', handleKeyDown));
  });
}

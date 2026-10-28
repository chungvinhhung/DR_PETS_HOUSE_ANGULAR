/**
 * Chuyển từ React: src/hooks/useCanvasScale.js
 *
 * Tính hệ số thu nhỏ để "canvas" Figma (mặc định 1440px) vừa với chiều ngang màn hình.
 * Không bao giờ phóng to quá 1 (giữ độ nét trên màn hình lớn).
 */
export const DEFAULT_DESIGN_WIDTH = 1440;

export function computeCanvasScale(viewportWidth: number, designWidth = DEFAULT_DESIGN_WIDTH, padding = 0): number {
  const available = Math.max(320, viewportWidth - padding);
  return Math.min(1, available / designWidth);
}

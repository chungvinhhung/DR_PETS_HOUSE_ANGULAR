/**
 * Chuyển từ React: src/components/groomingSpa/groomingMaskUtils.js
 */
/** CSS mask helpers for Figma cut-out shapes */
export function cssMask(url: any, size: any = "100% 100%", position: any = "0 0") {
  return {
    WebkitMaskImage: `url(${url})`,
    maskImage: `url(${url})`,
    WebkitMaskSize: size,
    maskSize: size,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: position,
    maskPosition: position,
  };
}

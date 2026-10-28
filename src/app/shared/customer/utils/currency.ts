/**
 * Chuyển từ React: src/utils/currency.js
 */
export function getNumericPrice(value: any) {
  if (typeof value === "number") return value;
  return Number(String(value ?? "").replace(/[^\d-]/g, "")) || 0;
}

export function formatVnd(value: any) {
  return `${new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(getNumericPrice(value))}đ`;
}

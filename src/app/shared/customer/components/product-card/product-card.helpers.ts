/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/components/product/ProductCard.jsx)
 */
import { productCardImages } from '../../assets/product-card-assets';
import { formatVnd, getNumericPrice } from '../../utils/currency';
import { buildProductPath } from '../../utils/slug';

export function getFirstValue(...values: any[]) {
  return values.find((value: any) => value !== undefined && value !== null && value !== "");
}

export function formatProductPrice(value: any) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "string" && !/\d/.test(value)) return value;

  return formatVnd(value);
}

/** Link tới trang chi tiết: luôn dùng URL slug chuẩn SEO /san-pham/<ten>-i.<id>. */
export function buildProductHref(product: any, fallbackHref: any) {
  const hasId = Boolean(getFirstValue(product?.id, product?.productId));
  if (fallbackHref && fallbackHref !== "/product-details") return fallbackHref;
  return hasId ? buildProductPath(product) : fallbackHref || undefined;
}


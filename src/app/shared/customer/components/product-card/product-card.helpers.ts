/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/components/product/ProductCard.jsx)
 */
import { productCardImages } from '../../assets/product-card-assets';
import { formatVnd, getNumericPrice } from '../../utils/currency';

export function getFirstValue(...values: any[]) {
  return values.find((value: any) => value !== undefined && value !== null && value !== "");
}

export function formatProductPrice(value: any) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "string" && !/\d/.test(value)) return value;

  return formatVnd(value);
}

export function buildProductHref(product: any, fallbackHref: any) {
  const slugOrId = getFirstValue(product?.slug, product?.id, product?.productId);
  if (fallbackHref) {
    return slugOrId && fallbackHref === "/product-details"
      ? `${fallbackHref}/${slugOrId}`
      : fallbackHref;
  }
  return slugOrId ? `/product-details/${slugOrId}` : undefined;
}


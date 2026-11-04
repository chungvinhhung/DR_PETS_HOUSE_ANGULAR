/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/components/cart/MyCartPanel.jsx)
 */
import { cartImages } from '../../../../shared/customer/assets/cart-images';
import { formatVnd, getNumericPrice } from '../../../../shared/customer/utils/currency';

export function formatPrice(value: any) {
  return formatVnd(value);
}

export function normalizeVariantOption(variant: any) {
  const name = variant.label ?? variant.name ?? variant.variant_name ?? "Mặc định";
  return {
    ...variant,
    id: variant.id ?? variant.variant_id,
    label: name,
    name,
    price: variant.finalPrice ?? variant.price ?? 0,
    sizes: Array.isArray(variant.sizes) ? variant.sizes : [],
  };
}

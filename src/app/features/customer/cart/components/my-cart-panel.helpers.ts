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
  return {
    ...variant,
    id: variant.id ?? variant.variant_id,
    name: variant.name ?? variant.variant_name ?? "Mặc định",
    price: variant.price ?? 0,
    sizes: Array.isArray(variant.sizes) ? variant.sizes : [],
  };
}


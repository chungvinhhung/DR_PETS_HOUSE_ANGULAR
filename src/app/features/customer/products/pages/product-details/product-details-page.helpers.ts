/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/pages/Product/ProductDetailsPage.jsx)
 */
import { productImages } from '../../../../../shared/customer/assets/product-images';
import { formatVnd } from '../../../../../shared/customer/utils/currency';
import { normalizeProduct, normalizeArray } from '../../../../../core/customer/services/api/product-api.service';
import { FEATURED_PRODUCTS, SHOP_PRODUCTS } from '../../../../../shared/customer/data/shop-data';

export const REVIEW_PAGE_SIZE = 2;

export const EMPTY_REVIEWS_DATA: any = { items: [], totalPages: 1, totalItems: 0, averageRating: 0, ratingBreakdown: {} };

export function buildFallbackProduct(product: any) {
  if (!product) return null;
  return normalizeProduct({
    ...product,
    description: product.description || "Thông tin sản phẩm đang được cập nhật. Bạn vẫn có thể tham khảo giá và thêm sản phẩm vào giỏ hàng.",
    shortDescription: product.shortDescription || "Sản phẩm chăm sóc thú cưng từ Dr. Pet's House. uhcbshbcc zxbhcbhbcacv xgchzxbj  ck  b uhbcahcbzxj kzjxh k  zxcgvbjh bzxk zxkhb zxucbshc zxj cxbcy fuhfasjhbjcjhdvjgvcjsasgucsuhcjzuhcbjdcdvczch",
    images: product.image ? [product.image] : [],
    variants: product.variants || [{ id: "default", name: "Mặc định", price: product.price, sizes: [] }],
    shipping: {
      freeShippingThreshold: 500000,
      deliveryEstimate: "2-4 ngày",
    },
  });
}

export function findFallbackProduct(productId: any) {
  return SHOP_PRODUCTS.find((item: any) => String(item.id) === String(productId)) || SHOP_PRODUCTS[0];
}

export function formatPrice(value: any) {
  return formatVnd(value);
}

export function formatReviewTime(createdAt: any): string {
  if (!createdAt) return '';

  let timestamp: number;
  if (typeof createdAt === 'number') {
    timestamp = createdAt < 1e11 ? createdAt * 1000 : createdAt;
  } else if (typeof createdAt === 'string') {
    if (/^\d+$/.test(createdAt.trim())) {
      const num = Number(createdAt.trim());
      timestamp = num < 1e11 ? num * 1000 : num;
    } else {
      timestamp = new Date(createdAt).getTime();
    }
  } else if (createdAt instanceof Date) {
    timestamp = createdAt.getTime();
  } else {
    return String(createdAt);
  }

  if (isNaN(timestamp) || timestamp <= 0) return String(createdAt);

  const now = Date.now();
  const diffMs = now - timestamp;
  if (diffMs < 0) return 'Vừa xong';

  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'Vừa xong';
  if (diffMinutes < 60) return `${diffMinutes} phút trước`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;

  const dateObj = new Date(timestamp);
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  return `${day}/${month}/${year}`;
}


export function normalizeReviewsData(response: any) {
  const metadataSource = response?.data && !Array.isArray(response.data) ? response.data : response;

  return {
    items: normalizeArray(response),
    totalPages: metadataSource?.totalPages ?? metadataSource?.pagination?.totalPages ?? 1,
    totalItems: metadataSource?.totalItems ?? metadataSource?.total ?? normalizeArray(response).length,
    averageRating: metadataSource?.averageRating ?? 0,
    ratingBreakdown: metadataSource?.ratingBreakdown ?? {},
  };
}


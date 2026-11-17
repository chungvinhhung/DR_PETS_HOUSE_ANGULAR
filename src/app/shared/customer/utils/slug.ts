/**
 * SLUG CHUẨN SEO (Nhiệm vụ 12).
 *
 * Backend chưa có trường `slug` cho sản phẩm -> FE tự sinh slug từ tên và gắn id ở cuối:
 *   /san-pham/bong-gam-cao-su-kong-classic-i.6af00f898b30ca61988e133e
 *   (giống quy ước "-i.<id>" của Shopee: đọc được, không trùng, đổi tên sản phẩm vẫn tìm ra nhờ id)
 *
 * Trang tìm kiếm dùng slug không dấu trên path:
 *   /tim-kiem/thuc-an-cho-meo
 */

export const PRODUCT_DETAIL_BASE = '/san-pham';
export const SEARCH_BASE = '/tim-kiem';

const PRODUCT_ID_SEPARATOR = '-i.';
const MAX_SLUG_LENGTH = 80;

/** "Thức ăn cho Mèo" -> "Thuc an cho Meo" */
export function removeVietnameseTones(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/** "Bóng gặm KONG® Classic (size M)" -> "bong-gam-kong-classic-size-m" */
export function slugify(value: unknown, maxLength = MAX_SLUG_LENGTH): string {
  const slug = removeVietnameseTones(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length <= maxLength) return slug;
  // Cắt ở ranh giới từ để không ra slug kiểu "bong-gam-ca"
  const cut = slug.slice(0, maxLength);
  return cut.slice(0, cut.lastIndexOf('-') > 0 ? cut.lastIndexOf('-') : maxLength).replace(/-+$/, '');
}

function getProductId(product: any): string {
  return String(product?.id ?? product?.productId ?? product?.product_id ?? product?._id ?? '').trim();
}

function getProductName(product: any): string {
  return String(product?.name ?? product?.productName ?? product?.product_name ?? '').trim();
}

/** Slug đầy đủ của 1 sản phẩm: "<ten-khong-dau>-i.<id>" (thiếu tên thì chỉ còn "i.<id>"). */
export function buildProductSlug(product: any): string {
  const id = getProductId(product);
  if (!id) return '';
  const nameSlug = slugify(getProductName(product));
  return nameSlug ? `${nameSlug}${PRODUCT_ID_SEPARATOR}${encodeURIComponent(id)}` : `i.${encodeURIComponent(id)}`;
}

/** Đường dẫn chuẩn (canonical) tới trang chi tiết sản phẩm. */
export function buildProductPath(product: any): string {
  const slug = buildProductSlug(product);
  return slug ? `${PRODUCT_DETAIL_BASE}/${slug}` : PRODUCT_DETAIL_BASE;
}

/**
 * Lấy id sản phẩm từ tham số trên URL. Chấp nhận:
 *  - slug mới: "bong-gam-kong-i.6af00f89..."  -> "6af00f89..."
 *  - "i.6af00f89..."                           -> "6af00f89..."
 *  - URL cũ /product-details/6af00f89...       -> "6af00f89..."
 */
export function extractProductId(param: unknown): string {
  const raw = decodeURIComponentSafe(String(param ?? '').trim());
  if (!raw) return '';
  const separatorIndex = raw.lastIndexOf(PRODUCT_ID_SEPARATOR);
  if (separatorIndex >= 0) return raw.slice(separatorIndex + PRODUCT_ID_SEPARATOR.length);
  if (raw.startsWith('i.')) return raw.slice(2);
  return raw;
}

/** Slug tìm kiếm: "Thức ăn cho mèo" -> "thuc-an-cho-meo" */
export function buildSearchSlug(query: unknown): string {
  return slugify(query, 120);
}

/** "/tim-kiem/thuc-an-cho-meo" (+ query string bộ lọc nếu có) */
export function buildSearchPath(query: unknown, params: Record<string, string | null | undefined> = {}): string {
  const slug = buildSearchSlug(query);
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value && !(key === 'type' && value === 'all') && !(key === 'sort' && value === 'relevant')) search.set(key, value);
  });
  const queryString = search.toString();
  return `${slug ? `${SEARCH_BASE}/${slug}` : SEARCH_BASE}${queryString ? `?${queryString}` : ''}`;
}

/** "thuc-an-cho-meo" -> "thuc an cho meo" (dấu tiếng Việt được SmartSearch khôi phục sau) */
export function searchSlugToQuery(slug: unknown): string {
  return decodeURIComponentSafe(String(slug ?? '')).replace(/[-_+]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeURIComponentSafe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

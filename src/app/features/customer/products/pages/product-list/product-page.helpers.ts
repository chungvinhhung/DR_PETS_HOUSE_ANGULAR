/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/pages/Product/ProductPage.jsx)
 */
import { productImages } from '../../../../../shared/customer/assets/product-images';
import { PRODUCT_CATEGORIES as CATEGORIES, PRODUCT_PRICE_RANGES as PRICE_RANGES, SHOP_PRODUCTS } from '../../../../../shared/customer/data/shop-data';

export const PAGE_SIZE = 20;

export const MULTI_CATEGORY_FETCH_LIMIT = 100;

export function isPriceInRange(price: any, range: any) {
  if (!range) return false;
  if (range.max === Infinity) return price >= range.min;
  return price >= range.min && price < range.max;
}

export const normalizeText = (value: any) => String(value || "").trim().toLocaleLowerCase("vi");

export const getCategoryProductCount = (category: any) => {
  const ownCount = Number(category?._count?.products ?? category?.products_count ?? category?.count ?? 0);
  const childrenCount = Array.isArray(category?.children)
    ? category.children.reduce((total: any, child: any) => total + getCategoryProductCount(child), 0)
    : 0;
  return ownCount + childrenCount;
};

export const buildCategoryOptions = (apiCategories: any = []) => {
  const apiCategoryMap = new Map<any, any>(
    apiCategories.map((category: any) => [normalizeText(category.category_name || category.label || category.name), category]),
  );

  return [
    {
      id: "all-categories",
      label: "Tất cả danh mục",
      count: apiCategories.length
        ? apiCategories.reduce((total: any, category: any) => total + getCategoryProductCount(category), 0)
        : CATEGORIES.reduce((total: any, category: any) => total + Number(category.count || 0), 0),
      index: null,
      categoryId: null,
    },
    ...CATEGORIES.map((category: any, index: any) => {
      const apiCategory = apiCategoryMap.get(normalizeText(category.label));
      return {
        id: category.slug,
        label: category.label,
        count: apiCategory ? getCategoryProductCount(apiCategory) : Number(category.count || 0),
        index,
        categoryId: apiCategory?.product_category_id ?? apiCategory?.category_id ?? apiCategory?.id ?? index + 1,
      };
    }),
  ];
};

export const toBackendSort = (sortOrder: any) => {
  if (sortOrder === "asc") return "price_asc";
  if (sortOrder === "desc") return "price_desc";
  return "newest";
};

export const getNumericPrice = (product: any) => Number(String(product?.price ?? 0).replace(/[^\d.-]/g, "")) || 0;

export const sortProducts = (products: any, sortOrder: any) => {
  if (sortOrder === "asc") return [...products].sort((a: any, b: any) => Number(getNumericPrice(a)) - Number(getNumericPrice(b)));
  if (sortOrder === "desc") return [...products].sort((a: any, b: any) => Number(getNumericPrice(b)) - Number(getNumericPrice(a)));
  return [...products].sort((a: any, b: any) => Number(new Date(b.created_at || 0)) - Number(new Date(a.created_at || 0)));
};

export const getFallbackProducts = ({ searchQuery, selectedCategories, selectedPrices, sortOrder }: any) => {
  const keyword = normalizeText(searchQuery);

  const filtered = SHOP_PRODUCTS.filter((product: any) => {
    if (selectedCategories.length > 0 && !selectedCategories.includes(product.categoryIdx)) return false;
    if (selectedPrices.length > 0) {
      const matchesSelectedPrice = selectedPrices.some((priceIndex: any) => isPriceInRange(product.price, (PRICE_RANGES as any)[priceIndex]));
      if (!matchesSelectedPrice) return false;
    }
    if (!keyword) return true;
    return normalizeText(product.name).includes(keyword);
  });

  if (sortOrder === "asc") return [...filtered].sort((a: any, b: any) => a.price - b.price);
  if (sortOrder === "desc") return [...filtered].sort((a: any, b: any) => b.price - a.price);
  return filtered;
};

export const getSelectedPriceRanges = (selectedPrices: any) =>
  (selectedPrices.map((priceIndex: any) => (PRICE_RANGES as any)[priceIndex]).filter(Boolean) as any[]);

export const buildFetchSpecs = ({ selectedCategoryIds, selectedPrices }: any) => {
  const categoryIds = selectedCategoryIds.length ? selectedCategoryIds : [undefined];
  const ranges = getSelectedPriceRanges(selectedPrices);
  const priceRanges = ranges.length ? ranges : [null];

  return categoryIds.flatMap((categoryId: any) =>
    priceRanges.map((range: any) => ({
      categoryId,
      range,
    })),
  );
};


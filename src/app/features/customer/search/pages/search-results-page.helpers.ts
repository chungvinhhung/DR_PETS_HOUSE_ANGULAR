/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/pages/Search/SearchResultsPage.jsx)
 */
import { SEARCH_DEMAND_TYPES, SEARCH_EMPTY_STATE, SEARCH_FILTER_GROUPS, SEARCH_SORT_OPTIONS, mockSearchApi } from '../../../../shared/customer/data/search-results-data';
import { formatVnd } from '../../../../shared/customer/utils/currency';

export const TYPE_IDS = SEARCH_DEMAND_TYPES.map((item: any) => item.id);

export const SORT_OPTIONS = Object.values(SEARCH_SORT_OPTIONS);

export const EMPTY_SEARCH_RESPONSE: any = {
  query: "",
  type: "all",
  sort: "relevant",
  total: 0,
  counts: { service: 0, shopping: 0, firstAid: 0, knowledge: 0, community: 0 },
  facets: SEARCH_FILTER_GROUPS,
  results: {
    services: [],
    otherServices: [],
    products: [],
    suggestedProducts: [],
    firstAid: [],
    knowledge: [],
    community: [],
  },
  emptyState: SEARCH_EMPTY_STATE,
};

const DEFAULT_PRODUCT_COUNTS: Record<string, number> = {
  "thuc-an": 14,
  "do-dung-thiet-yeu": 3,
  "cham-soc-suc-khoe": 10,
  "do-choi": 2,
  "phu-kien": 1,
};

const DEFAULT_SERVICE_COUNTS: Record<string, number> = {
  "spa-grooming": 12,
  "clinic": 7,
};

export function buildFacets(facetCounts: any = {}, results: any = {}) {
  const productCategoryCounts = {
    ...DEFAULT_PRODUCT_COUNTS,
    ...(facetCounts?.productCategories || {}),
  };
  const serviceCategoryCounts = {
    ...DEFAULT_SERVICE_COUNTS,
    ...(facetCounts?.serviceCategories || {}),
  };

  return SEARCH_FILTER_GROUPS.map((group: any) => {
    if (group.id === "productCategories") {
      const counts = productCategoryCounts;
      const total = Object.values(counts).reduce((sum: any, count: any) => sum + Number(count || 0), 0);
      return {
        ...group,
        options: group.options.map((option: any, index: any) => {
          const directCount = counts[option.id] ?? counts[option.slug];
          const indexedCount = (counts as any)[String(index)] ?? (counts as any)[String(index + 1)];
          const fallback = (DEFAULT_PRODUCT_COUNTS as any)[option.id] ?? (DEFAULT_PRODUCT_COUNTS as any)[option.slug] ?? 0;
          return {
            ...option,
            count: option.id === "all-categories" ? total : Number(directCount ?? indexedCount ?? fallback),
          };
        }),
      };
    }

    if (group.id === "serviceGroups") {
      const counts = serviceCategoryCounts;
      const total = Object.values(counts).reduce((sum: any, count: any) => sum + Number(count || 0), 0);
      return {
        ...group,
        options: group.options.map((option: any, index: any) => {
          const directCount = counts[option.id] ?? counts[option.slug];
          const indexedCount = (counts as any)[String(index)] ?? (counts as any)[String(index + 1)];
          const fallback = (DEFAULT_SERVICE_COUNTS as any)[option.id] ?? (DEFAULT_SERVICE_COUNTS as any)[option.slug] ?? 0;
          return {
            ...option,
            count: option.id === "all-services" ? total : Number(directCount ?? indexedCount ?? fallback),
          };
        }),
      };
    }

    if (group.id === "firstAid") {
      const items = Array.isArray(results?.firstAid) ? results.firstAid : [];
      const counts = items.reduce((acc: Record<string, number>, item: any) => {
        const categoryId = getArticleCategoryId(item);
        if (categoryId) acc[String(categoryId)] = (acc[String(categoryId)] || 0) + 1;
        return acc;
      }, {});
      return {
        ...group,
        options: group.options.map((option: any) => ({
          ...option,
          count: option.id === "all-first-aid" ? items.length : Number(counts[option.id] || 0),
        })),
      };
    }

    if (group.id === "knowledge") {
      const items = Array.isArray(results?.knowledge) ? results.knowledge : [];
      const counts = items.reduce((acc: Record<string, number>, item: any) => {
        const categoryId = getArticleCategoryId(item);
        if (categoryId) acc[String(categoryId)] = (acc[String(categoryId)] || 0) + 1;
        return acc;
      }, {});
      return {
        ...group,
        options: group.options.map((option: any) => ({
          ...option,
          count: option.id === "all-knowledge" ? items.length : Number(counts[option.id] || 0),
        })),
      };
    }

    if (group.id === "community") {
      const items = Array.isArray(results?.community) ? results.community : [];
      const counts = items.reduce((acc: Record<string, number>, item: any) => {
        const filterId = getCommunityFilterId(item);
        if (filterId) acc[String(filterId)] = (acc[String(filterId)] || 0) + 1;
        return acc;
      }, {});
      return {
        ...group,
        options: group.options.map((option: any) => ({
          ...option,
          count: option.id === "all-community" ? items.length : Number(counts[option.id] || 0),
        })),
      };
    }

    return group;
  });
}

export function formatServicePrice(value: any) {
  return `Từ ${formatVnd(value)}`;
}

export function parseServicePrice(price: any) {
  const numeric = String(price).replace(/[^\d]/g, "");
  return Number(numeric) || 0;
}

export function normalizePriceValue(value: any) {
  const price = Number(value) || 0;
  return price > 0 && price < 1000 ? price * 1000 : price;
}

export function getSearchItemPrice(item: any) {
  return normalizePriceValue(item?.priceValue ?? item?.price ?? parseServicePrice(item?.price));
}

export function isSearchPriceInRange(price: any, rangeId: any) {
  if (rangeId === "20-50") return price >= 20000 && price < 50000;
  if (rangeId === "50-100") return price >= 50000 && price < 100000;
  if (rangeId === "100-200") return price >= 100000 && price < 200000;
  if (rangeId === "200-plus") return price >= 200000;
  return true;
}

export function matchesAnySelected(value: any, selectedValues: any) {
  return selectedValues.length === 0 || selectedValues.includes(value);
}

export function getSelectedGroupValues(selectedFilters: any, groupId: any, allOptionId: any) {
  const values = (selectedFilters as any)[groupId] || [];
  return values.includes(allOptionId) ? [] : values;
}

export function getProductCategoryId(product: any): string {
  const rawSlug = String(product?.categorySlug || product?.category?.slug || product?.categoryId?.slug || '').toLowerCase();
  if (rawSlug) {
    if (rawSlug.includes('thuc-an')) return 'thuc-an';
    if (rawSlug.includes('do-dung') || rawSlug.includes('ve-sinh')) return 'do-dung-thiet-yeu';
    if (rawSlug.includes('suc-khoe') || rawSlug.includes('y-te')) return 'cham-soc-suc-khoe';
    if (rawSlug.includes('do-choi')) return 'do-choi';
    if (rawSlug.includes('phu-kien')) return 'phu-kien';
    return rawSlug;
  }

  const name = String(product?.categoryName || product?.category?.name || product?.categoryId?.name || product?.category || product?.name || '').toLowerCase();
  if (name.includes('thức ăn') || name.includes('thuc an') || name.includes('hạt') || name.includes('pate') || name.includes('snack') || name.includes('bánh thưởng')) {
    return 'thuc-an';
  }
  if (name.includes('đồ dùng') || name.includes('do dung') || name.includes('vệ sinh') || name.includes('khay') || name.includes('chuồng') || name.includes('lồng') || name.includes('cát')) {
    return 'do-dung-thiet-yeu';
  }
  if (name.includes('sức khỏe') || name.includes('suc khoe') || name.includes('thuốc') || name.includes('vitamin') || name.includes('dinh dưỡng') || name.includes('sữa tắm')) {
    return 'cham-soc-suc-khoe';
  }
  if (name.includes('đồ chơi') || name.includes('do choi') || name.includes('bóng') || name.includes('gặm') || name.includes('cào')) {
    return 'do-choi';
  }
  if (name.includes('phụ kiện') || name.includes('phu kien') || name.includes('vòng cổ') || name.includes('dây dắt') || name.includes('quần áo') || name.includes('bát')) {
    return 'phu-kien';
  }

  if (typeof product?.categoryIdx === 'number' && product.categoryIdx >= 0 && product.categoryIdx < 5) {
    return ['thuc-an', 'do-dung-thiet-yeu', 'cham-soc-suc-khoe', 'do-choi', 'phu-kien'][product.categoryIdx];
  }

  return String(product?.categorySlug || product?.category || product?.categoryId || '');
}

export function getArticleCategoryId(post: any) {
  return post?.category || post?.categoryId || post?.categorySlug;
}

export function getCommunityFilterId(post: any) {
  const type = post?.type;
  const map = {
    "Khoảnh khắc": "moment",
    "Hỏi đáp": "qa",
    "Mẹo vặt": "tips",
    "Kinh nghiệm": "experience",
  };

  return (map as any)[type] || post?.category || post?.tag;
}

export function filterPriceItems(items: any, selectedPriceRanges: any) {
  if (!selectedPriceRanges.length) return items;
  return items.filter((item: any) => {
    const price = getSearchItemPrice(item);
    return selectedPriceRanges.some((rangeId: any) => isSearchPriceInRange(price, rangeId));
  });
}

export function buildSearchCounts(results: any) {
  return {
    service: results.services.length + results.otherServices.length,
    // Sản phẩm bán chéo (suggestedProducts) không phải kết quả khớp -> không cộng vào số đếm
    shopping: results.products.length,
    firstAid: results.firstAid.length,
    knowledge: results.knowledge.length,
    community: results.community.length,
  };
}

export function filterAppliesToType(groupId: any, activeType: any) {
  return SEARCH_FILTER_GROUPS.find((group: any) => group.id === groupId)?.appliesTo.includes(activeType);
}

export function applySearchFilters(results: any, selectedFilters: any, activeType: any) {
  const selectedServiceGroups = filterAppliesToType("serviceGroups", activeType)
    ? getSelectedGroupValues(selectedFilters, "serviceGroups", "all-services")
    : [];
  const selectedProductCategories = filterAppliesToType("productCategories", activeType)
    ? getSelectedGroupValues(selectedFilters, "productCategories", "all-categories")
    : [];
  const selectedPriceRanges = filterAppliesToType("priceRanges", activeType)
    ? selectedFilters.priceRanges || []
    : [];
  const selectedFirstAid = filterAppliesToType("firstAid", activeType)
    ? getSelectedGroupValues(selectedFilters, "firstAid", "all-first-aid")
    : [];
  const selectedKnowledge = filterAppliesToType("knowledge", activeType)
    ? getSelectedGroupValues(selectedFilters, "knowledge", "all-knowledge")
    : [];
  const selectedCommunity = filterAppliesToType("community", activeType)
    ? getSelectedGroupValues(selectedFilters, "community", "all-community")
    : [];
  const filterService = (item: any) => {
    if (!selectedServiceGroups.length) return true;
    const itemGroupId = item.groupId || item.group || (
      String(item.serviceType || '').toUpperCase().includes('GROOMING') || /spa|tắm|tam|tỉa|tia|groom|cắt|cat|vệ sinh|ve sinh/i.test(item.name || item.title || '')
        ? 'spa-grooming'
        : 'clinic'
    );
    return selectedServiceGroups.includes(itemGroupId);
  };
  const filterProduct = (item: any) => matchesAnySelected(getProductCategoryId(item), selectedProductCategories);

  return {
    services: filterPriceItems(results.services.filter(filterService), selectedPriceRanges),
    otherServices: filterPriceItems(results.otherServices.filter(filterService), selectedPriceRanges),
    products: filterPriceItems(results.products.filter(filterProduct), selectedPriceRanges),
    suggestedProducts: filterPriceItems(results.suggestedProducts.filter(filterProduct), selectedPriceRanges),
    firstAid: results.firstAid.filter((item: any) => matchesAnySelected(getArticleCategoryId(item), selectedFirstAid)),
    knowledge: results.knowledge.filter((item: any) => matchesAnySelected(getArticleCategoryId(item), selectedKnowledge)),
    community: results.community.filter((item: any) => matchesAnySelected(getCommunityFilterId(item), selectedCommunity)),
  };
}


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

export function buildFacets(facetCounts: any = {}) {
  return SEARCH_FILTER_GROUPS.map((group: any) => {
    if (group.id === "productCategories") {
      const counts = facetCounts.productCategories || {};
      const total = Object.values(counts).reduce((sum: any, count: any) => sum + Number(count || 0), 0);
      return {
        ...group,
        options: group.options.map((option: any, index: any) => ({
          ...option,
          count: option.id === "all-categories" ? total : Number((counts as any)[String(index)] || (counts as any)[String(index + 1)] || 0),
        })),
      };
    }

    if (group.id === "serviceGroups") {
      const counts = facetCounts.serviceCategories || {};
      const total = Object.values(counts).reduce((sum: any, count: any) => sum + Number(count || 0), 0);
      return {
        ...group,
        options: group.options.map((option: any, index: any) => ({
          ...option,
          count: option.id === "all-services" ? total : Number((counts as any)[String(index)] || (counts as any)[String(index + 1)] || 0),
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

export function getProductCategoryId(product: any) {
  return product?.categorySlug || product?.category || product?.categoryId;
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
  const filterService = (item: any) => matchesAnySelected(item.groupId, selectedServiceGroups);
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


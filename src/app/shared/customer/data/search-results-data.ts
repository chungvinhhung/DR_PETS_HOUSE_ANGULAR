/**
 * Chuyển từ React: src/data/searchResultsData.js
 */
import { GROOMING_SERVICES } from './grooming-data';
import { ALL_BLOG_POSTS } from './blog-data';
import { COMMUNITY_POSTS } from './community-data';
import { FIRST_AID_POSTS } from './first-aid-data';
import { PRODUCT_CATEGORIES, SHOP_PRODUCTS } from './shop-data';
import { normalizeSearchText, rankSearchCandidates } from '../utils/search-suggestion.utils';

const searchProducts = SHOP_PRODUCTS.slice(0, 9).map((product: any, index: any) => ({
  ...product,
  name: index === 0 ? "ten sp" : product.name,
  categorySlug: (PRODUCT_CATEGORIES as any)[product.categoryIdx]?.slug,
}));

const COMMUNITY_TYPE_TO_FILTER_ID = {
  "Khoảnh khắc": "moment",
  "Hỏi đáp": "qa",
  "Mẹo vặt": "tips",
  "Kinh nghiệm": "experience",
};

export const SEARCH_DEMAND_TYPES = [
  { id: "all", label: "Tất cả" },
  { id: "service", label: "Dịch vụ" },
  { id: "shopping", label: "Mua sắm" },
  { id: "article", label: "Bài viết" },
];

export const SEARCH_SORT_OPTIONS = {
  relevant: { id: "relevant", label: "Liên quan nhất", appliesTo: ["all", "service", "shopping", "article"] },
  priceAsc: { id: "priceAsc", label: "Giá thấp đến cao", appliesTo: ["all", "service", "shopping"] },
  priceDesc: { id: "priceDesc", label: "Giá cao đến thấp", appliesTo: ["all", "service", "shopping"] },
  newest: { id: "newest", label: "Mới nhất", appliesTo: ["all", "article"] },
};

export const SEARCH_FILTER_GROUPS = [
  {
    id: "serviceGroups",
    title: "Nhóm dịch vụ",
    appliesTo: ["all", "service"],
    options: [
      { id: "all-services", label: "Tất cả dịch vụ", count: 0 },
      { id: "spa-grooming", label: "Spa & Grooming", count: 0 },
      { id: "clinic", label: "Khám & Điều trị", count: 0 },
    ],
  },
  {
    id: "productCategories",
    title: "Danh mục",
    appliesTo: ["all", "shopping"],
    options: [
      { id: "all-categories", label: "Tất cả danh mục", count: 0 },
      ...PRODUCT_CATEGORIES.map((category: any, index: any) => ({
        id: category.slug,
        label: category.label,
        count: 0,
      })),
    ],
  },
  {
    id: "priceRanges",
    title: "Khoảng giá",
    appliesTo: ["all", "service", "shopping"],
    options: [
      { id: "20-50", label: "20.000đ - 50.000đ", count: null },
      { id: "50-100", label: "50.000đ - 100.000đ", count: null },
      { id: "100-200", label: "100.000đ - 200.000đ", count: null },
      { id: "200-plus", label: "200.000đ trở lên", count: null },
    ],
  },
  {
    id: "firstAid",
    title: "Cẩm nang",
    appliesTo: ["all", "article"],
    options: [
      { id: "all-first-aid", label: "Tất cả cẩm nang", count: 0 },
      { id: "accident", label: "Tai nạn", count: 0 },
      { id: "poisoning", label: "Ngộ độc", count: 0 },
      { id: "breathing", label: "Khó thở", count: 0 },
      { id: "injury", label: "Chấn thương", count: 0 },
    ],
  },
  {
    id: "knowledge",
    title: "Kiến thức",
    appliesTo: ["all", "article"],
    options: [
      { id: "all-knowledge", label: "Tất cả kiến thức", count: 0 },
      { id: "health", label: "Sức khỏe", count: 0 },
      { id: "nutrition", label: "Dinh dưỡng", count: 0 },
      { id: "psychology", label: "Tâm lý", count: 0 },
      { id: "grooming", label: "Vệ sinh & Làm đẹp", count: 0 },
    ],
  },
  {
    id: "community",
    title: "Cộng đồng",
    appliesTo: ["all", "article"],
    options: [
      { id: "all-community", label: "Tất cả thẻ", count: 0 },
      { id: "moment", label: "Khoảnh khắc", count: 0 },
      { id: "qa", label: "Hỏi đáp", count: 0 },
      { id: "tips", label: "Mẹo vặt", count: 0 },
      { id: "experience", label: "Kinh nghiệm", count: 0 },
    ],
  },
];

export const SEARCH_RESULTS = {
  services: GROOMING_SERVICES.slice(0, 3).map((service: any, index: any) => ({
    ...service,
    groupId: "spa-grooming",
    priceValue: ([50, 150, 100] as any)[index],
  })),
  otherServices: GROOMING_SERVICES.slice(1, 3).map((service: any, index: any) => ({
    ...service,
    groupId: "spa-grooming",
    priceValue: ([50, 30] as any)[index],
  })),
  products: searchProducts,
  suggestedProducts: SHOP_PRODUCTS.slice(9, 13),
  firstAid: FIRST_AID_POSTS.slice(2, 6),
  knowledge: ALL_BLOG_POSTS.slice(0, 5),
  community: COMMUNITY_POSTS.slice(2, 4),
};

export const SEARCH_SUMMARY = {
  total: 21,
  service: 3,
  shopping: 9,
  firstAid: 4,
  knowledge: 5,
};

export const SEARCH_EMPTY_STATE = {
  summary: "Tìm thấy 0 kết quả phù hợp",
  title: "Không tìm thấy kết quả phù hợp",
  description:
    "Hãy thử điều chỉnh bộ lọc hiện tại! Bạn cũng có thể dùng từ khóa khác hoặc quay về trang chủ để khám phá thêm.",
  retryLabel: "Thử từ khóa khác",
  retryQuery: "tắm",
  homeLabel: "Về trang chủ",
  homeHref: "/",
};

function collectSearchableText(item: any) {
  if (!item || typeof item !== "object") return "";

  return ([
    item.title,
    item.name,
    item.description,
    item.excerpt,
    item.content,
    item.categoryLabel,
    item.type,
    item.author,
    ...(item.tags || []),
  ]
    .filter(Boolean) as any[])
    .join(" ");
}

function matchesQuery(item: any, query: any) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;
  return normalizeSearchText(collectSearchableText(item)).includes(normalizedQuery);
}

function sortByPrice(items: any, sort: any) {
  if (!["priceAsc", "priceDesc"].includes(sort)) return items;

  return [...items].sort((a: any, b: any) => {
    const left = a.priceValue ?? a.price ?? 0;
    const right = b.priceValue ?? b.price ?? 0;
    return sort === "priceAsc" ? left - right : right - left;
  });
}

function filterResultBuckets(query: any) {
  return {
    services: SEARCH_RESULTS.services.filter((item: any) => matchesQuery(item, query)),
    otherServices: SEARCH_RESULTS.otherServices.filter((item: any) => matchesQuery(item, query)),
    products: SEARCH_RESULTS.products.filter((item: any) => matchesQuery(item, query)),
    suggestedProducts: SEARCH_RESULTS.suggestedProducts.filter((item: any) => matchesQuery(item, query)),
    firstAid: SEARCH_RESULTS.firstAid.filter((item: any) => matchesQuery(item, query)),
    knowledge: SEARCH_RESULTS.knowledge.filter((item: any) => matchesQuery(item, query)),
    community: SEARCH_RESULTS.community.filter((item: any) => matchesQuery(item, query)),
  };
}

function buildCounts(results: any) {
  return {
    service: results.services.length,
    shopping: results.products.length,
    firstAid: results.firstAid.length,
    knowledge: results.knowledge.length,
    community: results.community.length,
  };
}

function applyTypeAndSort(results: any, type: any, sort: any) {
  if (type === "service") {
    return {
      ...results,
      services: sortByPrice(results.services, sort),
      otherServices: sortByPrice(results.otherServices, sort),
      products: [],
      suggestedProducts: [],
      firstAid: [],
      knowledge: [],
      community: [],
    };
  }

  if (type === "shopping") {
    return {
      ...results,
      services: [],
      otherServices: [],
      products: sortByPrice(results.products, sort),
      suggestedProducts: sortByPrice(results.suggestedProducts, sort),
      firstAid: [],
      knowledge: [],
      community: [],
    };
  }

  if (type === "article") {
    return {
      ...results,
      services: [],
      otherServices: [],
      products: [],
      suggestedProducts: [],
    };
  }

  return {
    ...results,
    services: sortByPrice(results.services, sort),
    otherServices: sortByPrice(results.otherServices, sort),
    products: sortByPrice(results.products, sort),
    suggestedProducts: sortByPrice(results.suggestedProducts, sort),
  };
}

const FACET_RESULT_CONFIG = {
  serviceGroups: {
    allOptionId: "all-services",
    getItems: (results: any) => results.services,
    getOptionId: (item: any) => item.groupId,
  },
  productCategories: {
    allOptionId: "all-categories",
    getItems: (results: any) => results.products,
    getOptionId: (item: any) => item.categorySlug,
  },
  firstAid: {
    allOptionId: "all-first-aid",
    getItems: (results: any) => results.firstAid,
    getOptionId: (item: any) => item.category,
  },
  knowledge: {
    allOptionId: "all-knowledge",
    getItems: (results: any) => results.knowledge,
    getOptionId: (item: any) => item.category,
  },
  community: {
    allOptionId: "all-community",
    getItems: (results: any) => results.community,
    getOptionId: (item: any) => (COMMUNITY_TYPE_TO_FILTER_ID as any)[item.type],
  },
};

function countByFacetOption(items: any, getOptionId: any) {
  return items.reduce((counts: any, item: any) => {
    const optionId = getOptionId(item);
    if (!optionId) return counts;
    return {
      ...counts,
      [optionId]: ((counts as any)[optionId] || 0) + 1,
    };
  }, {});
}

function buildFacets(results: any) {
  return SEARCH_FILTER_GROUPS.map((group: any) => {
    const config = (FACET_RESULT_CONFIG as any)[group.id];
    if (!config) return group;

    const items = config.getItems(results);
    const optionCounts = countByFacetOption(items, config.getOptionId);

    return {
      ...group,
      options: group.options.map((option: any) => ({
        ...option,
        count: option.id === config.allOptionId ? items.length : (optionCounts as any)[option.id] || 0,
      })),
    };
  });
}

function buildKeywordSuggestion(label: any, type: any, metadata: any = []) {
  if (!label) return null;

  return {
    id: `${type}-${normalizeSearchText(label)}`,
    label,
    href: `/search?q=${encodeURIComponent(label)}`,
    type,
    metadata,
  };
}

function getProductCategoryLabel(product: any) {
  return (PRODUCT_CATEGORIES as any)[product.categoryIdx]?.label || "";
}

function collectAvailableTags() {
  return [
    ...GROOMING_SERVICES,
    ...SHOP_PRODUCTS,
    ...FIRST_AID_POSTS,
    ...ALL_BLOG_POSTS,
    ...COMMUNITY_POSTS,
  ].flatMap((item: any) => item.tags || []);
}

function searchSuggestionSources() {
  const serviceCategoryOptions = SEARCH_FILTER_GROUPS
    .find((group: any) => group.id === "serviceGroups")
    ?.options.filter((option: any) => !option.id.startsWith("all-")) || [];

  return ([
    ...GROOMING_SERVICES.map((service: any) =>
      buildKeywordSuggestion(service.title, "service", [
        service.description,
        "Spa & Grooming",
        ...(service.tags || []),
      ]),
    ),
    ...SHOP_PRODUCTS.map((product: any) =>
      buildKeywordSuggestion(product.name, "product", [
        getProductCategoryLabel(product),
        product.description,
        product.shortDescription,
        ...(product.tags || []),
      ]),
    ),
    ...serviceCategoryOptions.map((category: any) =>
      buildKeywordSuggestion(category.label, "service-category", [category.label]),
    ),
    ...PRODUCT_CATEGORIES.map((category: any) =>
      buildKeywordSuggestion(category.label, "product-category", [category.label]),
    ),
    ...collectAvailableTags().map((tag: any) => buildKeywordSuggestion(tag, "tag", [tag])),
  ].filter(Boolean) as any[]);
}

function buildProductSuggestion(product: any) {
  if (!product) return null;

  return {
    id: product.id,
    name: product.name,
    label: product.name,
    price: product.price,
    image: product.image || product.imageSrc || product.thumbnail,
    href: `/product-details/${product.id}`,
    metadata: [
      getProductCategoryLabel(product),
      product.description,
      product.shortDescription,
      ...(product.tags || []),
    ],
  };
}

export function getSearchSuggestions(query: any, { limit = 4, productLimit = 2 }: any = {}) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return {
      suggestions: [],
      products: [],
      total: 0,
    };
  }

  const suggestions = rankSearchCandidates(searchSuggestionSources(), normalizedQuery).slice(0, limit);
  const suggestionLabels = new Set<any>(suggestions.map((item: any) => normalizeSearchText(item.label)));
  const rankedProducts = rankSearchCandidates(
    (SHOP_PRODUCTS.map(buildProductSuggestion).filter(Boolean) as any[]),
    normalizedQuery,
    { uniqueKey: (item: any) => item.id },
  );
  const productsWithoutDuplicateNames = rankedProducts.filter(
    (product: any) => !suggestionLabels.has(normalizeSearchText(product.name)),
  );
  const productPool = productsWithoutDuplicateNames.length >= productLimit
    ? productsWithoutDuplicateNames
    : rankedProducts;
  const products = productPool.slice(0, productLimit);

  return {
    suggestions,
    products,
    total: suggestions.length + products.length,
  };
}

export function mockSearchApi({ query = "tắm", type = "all", sort = "relevant" }: any = {}) {
  const matchedResults = filterResultBuckets(query);
  const counts = buildCounts(matchedResults);
  const total = counts.service + counts.shopping + counts.firstAid + counts.knowledge + counts.community;
  const results = applyTypeAndSort(matchedResults, type, sort);

  return {
    query,
    type,
    sort,
    total,
    counts,
    facets: buildFacets(matchedResults),
    results,
    emptyState: SEARCH_EMPTY_STATE,
  };
}

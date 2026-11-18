/**
 * Chuyển từ React: src/services/searchService.js
 *
 * - Các hàm "normalize..." / tiện ích không gọi API: giữ nguyên là hàm export (thuần, dùng được ở mọi nơi).
 * - Các hàm async gọi API: gom vào class SearchApiService (inject vào component).
 *   Gọi HTTP qua CustomerHttpService (bọc ApiClientService của core) -> trả về Promise như axios cũ.
 */
import { Injectable, inject } from '@angular/core';

import { CustomerHttpService, assertSuccess } from '../customer-http.service';
import { productCardImages } from '../../../../shared/customer/assets/product-card-assets';
import { normalizeBookingService } from './booking-api.service';
import { normalizeProduct } from './product-api.service';
import { analyzeSearchQuery, describeMatch, mergeById, rankSearchItems, demoteOtherSpecies } from '../smart-search';
import { ProductSearchIndexService } from '../product-search-index.service';
import { buildProductPath } from '../../../../shared/customer/utils/slug';

function toBackendScope(type: any) {
  if (type === "shopping") return "product";
  if (type === "article") return "blog";
  if (type === "service") return "service";
  return "all";
}

function toBackendSort(sort: any) {
  if (sort === "priceAsc") return "price_asc";
  if (sort === "priceDesc") return "price_desc";
  if (sort === "newest") return "newest";
  return "relevance";
}

function formatPublishedAt(value: any) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function normalizeSearchService(service: any = {}) {
  const normalized = normalizeBookingService(service);
  const rawType = String(service.serviceType || service.service_type || service.category || service.group || normalized.category || '').toUpperCase();
  const serviceName = String(service.name || service.title || normalized.name || '').toLowerCase();
  const isGrooming = rawType.includes('GROOMING') || rawType.includes('SPA') || /spa|tắm|tam|tỉa|tia|groom|cắt|cat|vệ sinh|ve sinh/i.test(serviceName);
  const groupId = isGrooming ? 'spa-grooming' : 'clinic';

  return {
    ...normalized,
    title: normalized.name,
    image: service.image_url || productCardImages.placeholder,
    priceValue: normalized.price,
    groupId,
    group: groupId,
    serviceType: isGrooming ? 'GROOMING' : 'MEDICAL',
  };
}

function normalizeSearchPost(post: any = {}) {
  return {
    ...post,
    id: post.slug || post.post_id,
    title: post.title || "Bai viet",
    image: post.thumbnail_url || productCardImages.placeholder,
    excerpt: post.excerpt || "",
    description: post.excerpt || "",
    category: "care",
    categoryLabel: post.category?.category_name || (post.post_type === "community" ? "Cong dong" : "Kien thuc"),
    publishedAt: formatPublishedAt(post.created_at),
    author: post.author?.full_name || "",
    likes: post.likes_count || 0,
    comments: 0,
    content: post.excerpt || "",
    tags: (String(post.hashtags || "").split(",").map((tag: any) => tag.trim()).filter(Boolean) as any[]),
  };
}

/**
 * Response /search có 3 dạng:
 *  - scope=all                  -> results = { products, services, blogs? }
 *  - scope=product|service|blog -> results = mảng thuần của đúng loại đó (không có _type)
 *  - bản cũ                     -> results = mảng có _type
 */
function splitSearchResults(payload: any) {
  const results = payload?.results;
  if (Array.isArray(results)) {
    const scope = payload?.scope;
    const typeOf = (item: any) => item._type ?? scope;
    return {
      products: results.filter((item: any) => typeOf(item) === "product"),
      services: results.filter((item: any) => typeOf(item) === "service"),
      blogs: results.filter((item: any) => typeOf(item) === "blog"),
    };
  }
  return {
    products: Array.isArray(results?.products) ? results.products : [],
    services: Array.isArray(results?.services) ? results.services : [],
    blogs: Array.isArray(results?.blogs) ? results.blogs : Array.isArray(results?.posts) ? results.posts : [],
  };
}

function emptyBuckets(): any {
  return {
    services: [],
    otherServices: [],
    products: [],
    suggestedProducts: [],
    firstAid: [],
    knowledge: [],
    community: [],
  };
}

function sortClientSide(items: any[], sort: any) {
  if (sort === "priceAsc") return [...items].sort((a, b) => (a.price || 0) - (b.price || 0));
  if (sort === "priceDesc") return [...items].sort((a, b) => (b.price || 0) - (a.price || 0));
  if (sort === "newest") {
    return [...items].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }
  return items;
}

/** Lần đầu tải chỉ mục có thể chậm (backend Render "ngủ") -> không bắt trang kết quả chờ quá lâu. */
const LOCAL_INDEX_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => window.setTimeout(() => resolve(fallback), ms)),
  ]);
}

@Injectable({ providedIn: 'root' })
export class SearchApiService {
  private readonly http = inject(CustomerHttpService);
  private readonly productIndex = inject(ProductSearchIndexService);

  /** Tải sẵn chỉ mục sản phẩm (tên + mô tả) khi người dùng bắt đầu tìm kiếm. */
  warmUpIndex(): void {
    this.productIndex.warmUp();
  }

  /**
   * Tìm kiếm thông minh: phân tích câu -> gọi song song tối đa 3 từ khóa đơn -> gộp -> xếp hạng lại.
   * (Backend hiện từ chối từ khóa có dấu cách và phân biệt dấu — xem smart-search.ts.)
   * Song song đó tìm trong chỉ mục FE (tên + danh mục + MÔ TẢ, không phân biệt dấu) và gộp vào kết quả.
   */
  async searchAll({ query, type = "all", sort = "relevant", limit = 50 }: any = {}) {
    const analysis = analyzeSearchQuery(query);
    const buckets = emptyBuckets();
    const baseResponse = {
      query: analysis.display || query,
      originalQuery: analysis.original,
      analysis,
      type,
      sort,
      facetCounts: {},
    };
    if (!analysis.apiKeywords.length) {
      return { ...baseResponse, total: 0, counts: this.countBuckets(buckets), results: buckets };
    }

    const includeProducts = type === "all" || type === "shopping";
    const [settled, localProducts] = await Promise.all([
      Promise.allSettled(
        analysis.apiKeywords.map((keyword) =>
          this.http.get("/search", {
            params: { keyword, scope: toBackendScope(type), sort: toBackendSort(sort), page: 1, limit },
          }),
        ),
      ),
      includeProducts ? withTimeout(this.productIndex.search(analysis.terms, limit), LOCAL_INDEX_TIMEOUT_MS, []) : Promise.resolve([]),
    ]);
    const payloads = settled
      .filter((result): result is PromiseFulfilledResult<any> => result.status === "fulfilled")
      .map((result) => splitSearchResults(assertSuccess(result.value)));

    let facetCounts: any = {};
    for (const s of settled) {
      if (s.status === "fulfilled") {
        const raw = assertSuccess<any>(s.value);
        if (raw?.facetCounts && (Object.keys(raw.facetCounts.productCategories || {}).length || Object.keys(raw.facetCounts.serviceCategories || {}).length)) {
          facetCounts = raw.facetCounts;
          break;
        }
      }
    }
    // Backend lỗi hết mà chỉ mục FE cũng không có gì -> báo lỗi để trang dùng dữ liệu dự phòng
    if (!payloads.length && !localProducts.length) {
      throw (settled[0] as PromiseRejectedResult).reason;
    }

    const products = demoteOtherSpecies(
      rankSearchItems(
        mergeById(
          [...payloads.map((payload) => payload.products), localProducts],
          (item: any) => item.id ?? item._id,
        ).map(normalizeProduct),
        analysis.terms,
        "product",
      ),
      analysis.pet,
    ).map((product: any) => ({ ...product, ...describeMatch(product, analysis.terms) }));
    const services = rankSearchItems(
      mergeById(payloads.map((payload) => payload.services), (item: any) => item.id ?? item.service_id).map(normalizeSearchService),
      analysis.terms,
      "service",
    );
    const blogs = rankSearchItems(
      mergeById(payloads.map((payload) => payload.blogs), (item: any) => item.post_id ?? item.slug ?? item.id).map(normalizeSearchPost),
      analysis.terms,
      "post",
    );

    buckets.products = sortClientSide(products, sort).map((product: any) => ({ ...product, href: buildProductPath(product) }));
    buckets.services = sortClientSide(services, sort);
    blogs.forEach((post: any) => (post.post_type === "community" ? buckets.community : buckets.knowledge).push(post));

    const counts = this.countBuckets(buckets);
    return {
      ...baseResponse,
      total: buckets.products.length + buckets.services.length + buckets.knowledge.length + buckets.community.length,
      counts,
      results: buckets,
    };
  }

  /**
   * Gợi ý khi đang gõ: gọi /search/suggestions với từ khóa đặc trưng nhất,
   * rồi xếp hạng lại theo TẤT CẢ các từ người dùng gõ.
   * /search/suggestions chỉ tìm theo TÊN -> bổ sung sản phẩm khớp MÔ TẢ từ chỉ mục FE (nếu đã tải xong).
   */
  async getSearchSuggestionsApi(query: any, limit: any = 6) {
    const analysis = analyzeSearchQuery(query);
    const keyword = analysis.apiKeywords[0];
    if (!keyword) return { suggestions: [], products: [], total: 0, analysis };

    const localProducts = this.productIndex.searchIfReady(analysis.terms, 10);
    let rawItems: any[] = [];
    try {
      const response: any = await this.http.get("/search/suggestions", {
        params: { q: keyword, limit: Math.max(Number(limit) * 2, 10) },
      });
      const payload = assertSuccess<any>(response);
      rawItems = Array.isArray(payload) ? payload : Array.isArray(payload?.suggestions) ? payload.suggestions : [];
    } catch (error) {
      if (!localProducts.length) throw error;
    }

    const ranked = rankSearchItems(
      mergeById(
        [
          rawItems.map((item: any) => ({ ...item, name: item.keyword || item.name || "", categoryName: item.category })),
          localProducts.map((product: any) => ({ ...product, keyword: product.name, type: "product" })),
        ],
        (item: any) => item.id ?? item.keyword,
      ),
      analysis.terms,
      "product",
    );

    const textSuggestions = [
      // "Có phải bạn muốn tìm": câu đã khôi phục dấu (vd. gõ "thuc an meo" -> "thức ăn mèo")
      ...(analysis.display && analysis.display !== analysis.original.toLowerCase()
        ? [{ id: `api-suggestion-restored-${analysis.display}`, label: analysis.display, count: 0, corrected: true }]
        : []),
      ...ranked.map((item: any, index: number) => ({
        id: `api-suggestion-${item.id || item.keyword || index}`,
        label: item.keyword || "",
        count: item.count || 0,
        type: item.type,
      })),
    ].filter((item: any) => item.label).slice(0, Number(limit));

    const products = ranked
      .filter((item: any) => item.type === "product" && item.id)
      .slice(0, 2)
      .map((item: any) => normalizeProduct({ ...item, categoryName: item.categoryName ?? item.category }))
      .map((product: any) => ({ ...product, ...describeMatch(product, analysis.terms), href: buildProductPath(product) }));

    return {
      suggestions: textSuggestions,
      products,
      total: ranked.length,
      analysis,
    };
  }

  private countBuckets(buckets: any) {
    return {
      service: buckets.services.length,
      shopping: buckets.products.length,
      firstAid: buckets.firstAid.length,
      knowledge: buckets.knowledge.length,
      community: buckets.community.length,
    };
  }
}

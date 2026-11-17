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
  return {
    ...normalized,
    title: normalized.name,
    image: service.image_url || productCardImages.placeholder,
    priceValue: normalized.price,
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

function buildResultBuckets(rawResults: any = []) {
  const buckets: any = {
    services: [],
    otherServices: [],
    products: [],
    suggestedProducts: [],
    firstAid: [],
    knowledge: [],
    community: [],
  };

  if (!rawResults) return buckets;

  // Trường hợp 1: Backend MongoDB trả về object { products: [...], services: [...] } khi scope=all
  if (typeof rawResults === 'object' && !Array.isArray(rawResults)) {
    if (Array.isArray(rawResults.services)) {
      rawResults.services.forEach((s: any) => {
        buckets.services.push(normalizeSearchService(s));
      });
    }
    if (Array.isArray(rawResults.products)) {
      rawResults.products.forEach((p: any) => {
        buckets.products.push(normalizeProduct(p));
      });
    }
    return buckets;
  }

  // Trường hợp 2: Mảng phẳng (scope=product hoặc scope=service hoặc legacy items)
  if (Array.isArray(rawResults)) {
    rawResults.forEach((item: any) => {
      if (item._type === "service" || item.serviceType || item.durationMinutes !== undefined) {
        buckets.services.push(normalizeSearchService(item));
        return;
      }
      if (item._type === "product" || item.variants || item.productCode) {
        buckets.products.push(normalizeProduct(item));
        return;
      }
      if (item._type === "blog") {
        const post = normalizeSearchPost(item);
        if (item.post_type === "community") {
          buckets.community.push(post);
        } else {
          buckets.knowledge.push(post);
        }
      }
    });
  }

  return buckets;
}

@Injectable({ providedIn: 'root' })
export class SearchApiService {
  private readonly http = inject(CustomerHttpService);

  async searchAll({ query, type = "all", sort = "relevant", page = 1, limit = 30 }: any = {}) {
    const response = await this.http.get("/search", {
      params: {
        keyword: query,
        q: query,
        scope: toBackendScope(type),
        sort: toBackendSort(sort),
        page,
        limit,
      },
    });
    const payload = assertSuccess(response);
    const results = buildResultBuckets(payload?.results || payload?.data?.results || []);
    const counts = {
      service: payload?.counts?.service ?? results.services.length,
      shopping: payload?.counts?.product ?? results.products.length,
      firstAid: 0,
      knowledge: payload?.counts?.blog || 0,
      community: results.community.length,
    };
  
    return {
      query: payload?.query || payload?.keyword || query,
      type,
      sort,
      total: payload?.totalRows ?? (counts.service + counts.shopping),
      counts,
      facetCounts: payload?.facetCounts || {},
      results,
    };
  }

  async getSearchSuggestionsApi(query: any, limit: any = 6) {
    if (!query || !String(query).trim()) {
      return { suggestions: [], products: [], total: 0 };
    }

    const response = await this.http.get("/search/suggestions", {
      params: { q: query, limit },
    });
    const data = assertSuccess(response);
    const rawList: any[] = Array.isArray(data)
      ? data
      : (Array.isArray(data?.suggestions) ? data.suggestions : []);

    const suggestions: any[] = [];
    const products: any[] = [];

    rawList.forEach((item: any, index: number) => {
      if (item.type === 'product') {
        products.push({
          id: item.id || `prod-${index}`,
          name: item.keyword || item.name || '',
          price: item.price || 0,
          image: item.image || null,
          href: `/product-details/${item.id || item.code}`,
        });
      }
      suggestions.push({
        id: `api-suggestion-${item.keyword || index}`,
        label: item.keyword || item.name || '',
        count: item.count || 0,
        type: item.type || 'keyword',
        targetId: item.id,
        code: item.code,
        category: item.category,
      });
    });

    return {
      suggestions,
      products: products.slice(0, 4),
      total: rawList.length,
    };
  }
}

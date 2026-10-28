/**
 * Chuyển từ React: src/services/searchService.js
 *
 * - Các hàm "normalize..." / tiện ích không gọi API: giữ nguyên là hàm export (thuần, dùng được ở mọi nơi).
 * - Các hàm async gọi API: gom vào class SearchApiService (inject vào component).
 *   Gọi HTTP qua CustomerHttpService (bọc ApiClientService của core) -> trả về Promise như axios cũ.
 */
import { Injectable, inject } from '@angular/core';

import { CustomerHttpService } from '../customer-http.service';
import { productCardImages } from '../../../../shared/customer/assets/product-card-assets';
import { normalizeBookingService } from './booking-api.service';
import { normalizeProduct } from './product-api.service';

function assertSuccess(response: any) {
  if (response?.EC !== undefined && response.EC !== 0) {
    throw new Error(response.EM || "Tim kiem khong thanh cong");
  }
  return response?.DT ?? response;
}

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

function buildResultBuckets(items: any = []) {
  const buckets: any = {
    services: [],
    otherServices: [],
    products: [],
    suggestedProducts: [],
    firstAid: [],
    knowledge: [],
    community: [],
  };

  items.forEach((item: any) => {
    if (item._type === "service") {
      buckets.services.push(normalizeSearchService(item));
      return;
    }
    if (item._type === "product") {
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

  return buckets;
}

@Injectable({ providedIn: 'root' })
export class SearchApiService {
  private readonly http = inject(CustomerHttpService);

  async searchAll({ query, type = "all", sort = "relevant", page = 1, limit = 30 }: any = {}) {
    const response = await this.http.get("/search", {
      params: {
        keyword: query,
        scope: toBackendScope(type),
        sort: toBackendSort(sort),
        page,
        limit,
      },
    });
    const payload = assertSuccess(response);
    const results = buildResultBuckets(payload.results || []);
    const counts = {
      service: payload.counts?.service || 0,
      shopping: payload.counts?.product || 0,
      firstAid: 0,
      knowledge: payload.counts?.blog || 0,
      community: results.community.length,
    };
  
    return {
      query: payload.keyword || query,
      type,
      sort,
      total: payload.totalRows || 0,
      counts,
      facetCounts: payload.facetCounts || {},
      results,
    };
  }

  async getSearchSuggestionsApi(query: any, limit: any = 6) {
    const response = await this.http.get("/search/suggestions", {
      params: { q: query, limit },
    });
    const suggestions = assertSuccess(response);
  
    return {
      suggestions: Array.isArray(suggestions)
        ? suggestions.map((item: any, index: any) => ({
            id: `api-suggestion-${item.keyword || index}`,
            label: item.keyword || "",
            count: item.count || 0,
          })).filter((item: any) => item.label)
        : [],
      products: [],
      total: Array.isArray(suggestions) ? suggestions.length : 0,
    };
  }
}

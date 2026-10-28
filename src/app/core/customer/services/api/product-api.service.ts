/**
 * Chuyển từ React: src/services/productService.js
 *
 * - Các hàm "normalize..." / tiện ích không gọi API: giữ nguyên là hàm export (thuần, dùng được ở mọi nơi).
 * - Các hàm async gọi API: gom vào class ProductApiService (inject vào component).
 *   Gọi HTTP qua CustomerHttpService (bọc ApiClientService của core) -> trả về Promise như axios cũ.
 */
import { Injectable, inject } from '@angular/core';

import { CustomerHttpService } from '../customer-http.service';
import { environment } from '../../../../../environments/environment';

function unwrap(payload: any) {
  return payload?.data ?? payload;
}

function getPayload(payload: any) {
  return payload?.DT ?? payload?.data ?? payload;
}

function warnOptionalApiFailure(apiName: any, error: any) {
  if (!environment.production) {
    console.warn(`${apiName} API is unavailable. Falling back to empty data.`, error);
  }
}

export function normalizeArray(response: any) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.DT)) return response.DT;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.data?.items)) return response.data.items;
  if (Array.isArray(response?.products)) return response.products;
  if (Array.isArray(response?.data?.products)) return response.data.products;
  if (Array.isArray(response?.DT?.products)) return response.DT.products;
  if (Array.isArray(response?.DT?.items)) return response.DT.items;
  if (Array.isArray(response?.DT?.reviews)) return response.DT.reviews;
  if (Array.isArray(response?.reviews)) return response.reviews;
  if (Array.isArray(response?.data?.reviews)) return response.data.reviews;
  return [];
}

function getFirstValue(...values: any[]) {
  return values.find((value: any) => value !== undefined && value !== null && value !== "");
}

function toNumber(value: any) {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return value;
  return Number(String(value).replace(/[^\d.-]/g, "")) || 0;
}

function normalizeImageUrl(value: any) {
  if (!value) return value;
  if (/^(https?:)?\/\//.test(value) || value.startsWith("data:") || value.startsWith("blob:")) {
    return value;
  }
  const backendUrl = environment.apiBaseUrl.replace(/\/api(\/v\d+)?\/?$/, "");
  if (!backendUrl) return value;
  return `${backendUrl.replace(/\/$/, "")}/${String(value).replace(/^\//, "")}`;
}

function normalizeVariant(variant: any) {
  if (!variant) return variant;
  return {
    ...variant,
    id: getFirstValue(variant.id, variant.variant_id),
    name: getFirstValue(variant.name, variant.variant_name),
    price: getFirstValue(variant.price, 0),
    originalPrice: getFirstValue(variant.originalPrice, variant.original_price),
    stockQuantity: getFirstValue(variant.stockQuantity, variant.stock_quantity, 0),
    sizes: Array.isArray(variant.sizes) ? variant.sizes : [],
  };
}

export function normalizeProduct(product: any) {
  const source = getPayload(product);
  const id = getFirstValue(source?.productId, source?.product_id, source?.id);
  const name = getFirstValue(source?.productName, source?.product_name, source?.name, "Sản phẩm");
  const productImages = Array.isArray(source?.product_images)
    ? ([...source.product_images]
        .sort((first: any, second: any) => Number(Number(Boolean(second?.is_primary))) - Number(Number(Boolean(first?.is_primary))))
        .map((item: any) => normalizeImageUrl(item?.image_url))
        .filter(Boolean) as any[])
    : [];
  const price = getFirstValue(
    source?.price,
    source?.product_price,
    source?.sellingPrice,
    source?.selling_price,
    source?.sale_price,
    0,
  );
  const originalPrice = getFirstValue(source?.originalPrice, source?.original_price, source?.oldPrice);
  const numericPrice = toNumber(price);
  const numericOriginalPrice = toNumber(originalPrice);
  const computedDiscountPercent =
    numericOriginalPrice > numericPrice && numericPrice > 0
      ? Math.round(((numericOriginalPrice - numericPrice) / numericOriginalPrice) * 100)
      : undefined;
  const image = normalizeImageUrl(
    getFirstValue(
      source?.imageUrl,
      source?.image_url,
      source?.product_image,
      source?.thumbnail_url,
      productImages[0],
      source?.images?.[0],
      source?.image,
      source?.thumbnail,
    ),
  );
  const categoryId = getFirstValue(source?.categoryId, source?.category_id, source?.product_category_id);
  const categoryIdx = Number.isFinite(Number(categoryId)) ? Number(Number(categoryId)) - 1 : source?.categoryIdx;

  return {
    ...source,
    id,
    productId: id,
    name,
    productName: name,
    price,
    originalPrice,
    discountPercent: getFirstValue(
      source?.discountPercent,
      source?.discount_percent,
      source?.discount_percentage,
      computedDiscountPercent,
    ),
    rating: getFirstValue(source?.rating, source?.averageRating, source?.average_rating, 0),
    image,
    imageUrl: image,
    images: productImages.length
      ? productImages
      : Array.isArray(source?.images)
        ? source.images.map(normalizeImageUrl)
        : image ? [image] : [],
    categoryIdx,
    variants: Array.isArray(source?.variants) ? source.variants.map(normalizeVariant) : [],
    stockQuantity: getFirstValue(source?.stockQuantity, source?.stock_quantity, 0),
    soldQuantity: getFirstValue(source?.soldQuantity, source?.sold_quantity, 0),
    reviewCount: getFirstValue(source?.reviewCount, source?._count?.reviews, source?.reviews_count, 0),
  };
}

function normalizeReview(review: any) {
  const source = getPayload(review);
  return {
    ...source,
    id: getFirstValue(source?.reviewId, source?.review_id, source?.id),
    authorName: getFirstValue(source?.authorName, source?.author_name, source?.user?.full_name, source?.full_name, source?.user_name, source?.customer_name, "Khách hàng"),
    authorAvatar: normalizeImageUrl(getFirstValue(source?.authorAvatar, source?.author_avatar, source?.user?.avatar_url, source?.avatar_url, source?.avatar)),
    rating: getFirstValue(source?.rating, source?.star, source?.stars, 0),
    content: getFirstValue(source?.content, source?.comment, source?.review_content, ""),
    likeCount: getFirstValue(source?.likeCount, source?.likes_count, source?.like_count, Array.isArray(source?.likes) ? source.likes.length : undefined, 0),
    createdAt: getFirstValue(source?.createdAt, source?.created_at, source?.created_date),
  };
}

function normalizeRatingBreakdown(breakdown: any) {
  if (!Array.isArray(breakdown)) return breakdown ?? {};
  return breakdown.reduce((result: any, item: any) => {
    const star = item.star ?? item.rating;
    if (!star) return result;
    return {
      ...result,
      [star]: item.percentage ?? item.percent ?? item.count ?? 0,
    };
  }, {});
}

@Injectable({ providedIn: 'root' })
export class ProductApiService {
  private readonly http = inject(CustomerHttpService);

  async getProducts(params: any = {}) {
    const response = unwrap(await this.http.get("/products", { params }));
    return normalizeArray(response).map(normalizeProduct);
  }

  async getProductsPage(params: any = {}) {
    const response = unwrap(await this.http.get("/products", { params }));
    const payload = getPayload(response);
    const products = normalizeArray(payload).map(normalizeProduct);
  
    return {
      products,
      totalRows: Number(payload?.totalRows ?? products.length),
      totalPages: Number(payload?.totalPages ?? 1),
      page: Number(params.page ?? 1),
      limit: Number(params.limit ?? (products.length || 10)),
    };
  }

  async getProductCategories() {
    const response = unwrap(await this.http.get("/categories"));
    return normalizeArray(response);
  }

  async getBestSellingProducts(limit: any = 12) {
    return this.getProducts({ sort: "best_selling", limit, page: 1 });
  }

  async getActiveFlashSale(limit: any = 12) {
    try {
      const response = unwrap(await this.http.get("/flash-sales/active"));
      const payload = getPayload(response);
      if (!payload) {
        return {
          sale: null,
          products: [],
        };
      }
  
      const items = Array.isArray(payload?.items) ? payload.items : normalizeArray(payload);
      const products = items
        .map((item: any) => {
          const product = item?.product ?? item?.Product ?? item;
          return normalizeProduct({
            ...product,
            price: item?.discount_price ?? product?.price,
            original_price: product?.original_price ?? product?.price,
            discount_percentage: item?.discount_percentage ?? product?.discount_percentage,
            flash_sale_item_id: item?.flash_sale_item_id,
          });
        })
        .slice(0, limit);
  
      return {
        sale: {
          id: getFirstValue(payload?.flash_sale_id, payload?.id),
          name: getFirstValue(payload?.name, payload?.flash_sale_name),
          startTime: getFirstValue(payload?.start_time, payload?.startTime),
          endTime: getFirstValue(payload?.end_time, payload?.endTime),
          status: payload?.status,
        },
        products,
      };
    } catch (error: any) {
      warnOptionalApiFailure("Active flash sale", error);
      return {
        sale: null,
        products: [],
      };
    }
  }

  async getActiveFlashSaleProducts(limit: any = 12) {
    const result = await this.getActiveFlashSale(limit);
    return result.products;
  }

  async getProductDetails(productId: any) {
    return normalizeProduct(unwrap(await this.http.get(`/products/${productId}`)));
  }

  async getProductReviews(productId: any, page: any = 1, pageSize: any = 2) {
    try {
      const [reviewsResponse, statsResponse] = await Promise.all([
        this.http.get(`/reviews/target/product/${productId}`, {
          params: { page, limit: pageSize },
        }),
        this.http.get(`/products/${productId}/review-stats`).catch((error: any) => {
          warnOptionalApiFailure("Product review stats", error);
          return null;
        }),
      ]);
      const reviewsPayload = getPayload(unwrap(reviewsResponse));
      const statsPayload = getPayload(unwrap(statsResponse));
  
      return {
        items: normalizeArray(reviewsResponse).map(normalizeReview),
        totalPages: reviewsPayload?.totalPages ?? 1,
        totalItems: reviewsPayload?.totalRows ?? reviewsPayload?.totalItems ?? statsPayload?.totalReviews ?? 0,
        averageRating: statsPayload?.averageRating ?? reviewsPayload?.averageRating ?? 0,
        ratingBreakdown: normalizeRatingBreakdown(statsPayload?.breakdown ?? reviewsPayload?.ratingBreakdown),
      };
    } catch (error: any) {
      warnOptionalApiFailure("Product reviews", error);
      return { items: [], totalPages: 1, totalItems: 0, averageRating: 0, ratingBreakdown: {} };
    }
  }

  async getSimilarProducts(productId: any, limit: any = 12) {
    try {
      const response = unwrap(await this.http.get(`/products/${productId}/related`));
      return normalizeArray(response).map(normalizeProduct).slice(0, limit);
    } catch (error: any) {
      warnOptionalApiFailure("Similar products", error);
      return [];
    }
  }

  async likeProductReview(productId: any, reviewId: any) {
    return unwrap(await this.http.post(`/reviews/${reviewId}/like`));
  }

  async createProductReview(productId: any, payload: any) {
    return unwrap(
      await this.http.post("/reviews", {
        target_type: "product",
        target_id: String(productId),
        rating: payload.rating,
        comment: payload.comment ?? payload.content ?? payload.review ?? "",
      }),
    );
  }
}

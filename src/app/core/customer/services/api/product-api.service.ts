/**
 * Chuyển từ React: src/services/productService.js
 *
 * - Các hàm "normalize..." / tiện ích không gọi API: giữ nguyên là hàm export (thuần, dùng được ở mọi nơi).
 * - Các hàm async gọi API: gom vào class ProductApiService (inject vào component).
 *   Gọi HTTP qua CustomerHttpService (bọc ApiClientService của core) -> trả về Promise như axios cũ.
 */
import { Injectable, inject } from '@angular/core';

import { CustomerHttpService, assertSuccess } from '../customer-http.service';
import { environment } from '../../../../../environments/environment';

function unwrap(payload: any) {
  return assertSuccess(payload);
}

function getPayload(payload: any) {
  return assertSuccess(payload);
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
  if (!value) return "";
  if (typeof value === 'object') {
    value = value.url || value.imageUrl || value.image_url || value.src || "";
  }
  if (!value || typeof value !== 'string') return "";
  if (/^(https?:)?\/\//.test(value) || value.startsWith("data:") || value.startsWith("blob:")) {
    return value;
  }
  const backendUrl = environment.apiBaseUrl.replace(/\/api(\/v\d+)?\/?$/, "");
  if (!backendUrl) return value;
  return `${backendUrl.replace(/\/$/, "")}/${String(value).replace(/^\//, "")}`;
}

function normalizeVariant(variant: any) {
  if (!variant) return variant;
  const label = getFirstValue(variant.label, variant.name, variant.variant_name, variant.sku, '');
  const name = label || 'Mặc định';

  const finalPrice = getFirstValue(variant.finalPrice, variant.final_price);
  const rawPrice = getFirstValue(variant.price, variant.originalPrice, variant.original_price, 0);

  const price = toNumber(finalPrice !== undefined && finalPrice !== null ? finalPrice : rawPrice);
  let originalPrice = getFirstValue(
    variant.originalPrice,
    variant.original_price,
    finalPrice !== undefined && rawPrice > finalPrice ? rawPrice : undefined
  );
  if (originalPrice !== undefined) {
    originalPrice = toNumber(originalPrice);
  }

  const stock = toNumber(
  getFirstValue(
    variant.availableStock,
    variant.stockQuantity,
    variant.stock_quantity,
    variant.stock,
    variant.quantity,
    variant.inventory,
    0
  ));
  const image = normalizeImageUrl(getFirstValue(variant.image, variant.imageUrl, variant.image_url));

  const discountPercent = getFirstValue(
    variant.discountPercent,
    variant.discount_percent,
    originalPrice && originalPrice > price && price > 0
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : undefined
  );

  return {
    ...variant,
    id: String(getFirstValue(variant.id, variant.variant_id, variant._id, variant.sku, '') || ''),
    label: name,
    name,
    variant_name: name,
    price,
    originalPrice: originalPrice && originalPrice > price ? originalPrice : undefined,
    discountPercent,
    stockQuantity: stock,
    availableStock: stock,
    image,
    imageUrl: image,
    sizes: Array.isArray(variant.sizes) ? variant.sizes : [],
  };
}

export function normalizeProduct(product: any) {
  const source = getPayload(product);
  const id = String(getFirstValue(source?.id, source?._id, source?.productId, source?.product_id, "") || "");
  const name = getFirstValue(source?.name, source?.productName, source?.product_name, "Sản phẩm");

  let productImages: string[] = [];
  if (Array.isArray(source?.images)) {
    productImages = source.images.map(normalizeImageUrl).filter(Boolean);
  } else if (Array.isArray(source?.product_images)) {
    productImages = source.product_images.map(normalizeImageUrl).filter(Boolean);
  }

  const image = normalizeImageUrl(
    getFirstValue(
      source?.image,
      source?.thumbnailUrl,
      source?.thumbnail_url,
      source?.imageUrl,
      source?.image_url,
      source?.product_image,
      productImages[0],
      ""
    )
  );

  const price = getFirstValue(
    source?.price,
    source?.finalPrice,
    source?.minPrice,
    source?.minFinalPrice,
    source?.variants?.[0]?.finalPrice,
    source?.variants?.[0]?.price,
    source?.product_price,
    source?.sellingPrice,
    0
  );
  const originalPrice = getFirstValue(
    source?.originalPrice,
    source?.original_price,
    source?.oldPrice,
    source?.maxPrice,
    source?.variants?.[0]?.price
  );
  const numericPrice = toNumber(price);
  const numericOriginalPrice = toNumber(originalPrice);
  const computedDiscountPercent =
    numericOriginalPrice > numericPrice && numericPrice > 0
      ? Math.round(((numericOriginalPrice - numericPrice) / numericOriginalPrice) * 100)
      : undefined;

  const categoryId = getFirstValue(source?.categoryId, source?.category_id, source?.product_category_id);
  const categoryIdx = Number.isFinite(Number(categoryId)) ? Number(Number(categoryId)) - 1 : source?.categoryIdx;

  return {
    ...source,
    id,
    productId: id,
    name,
    productName: name,
    price: numericPrice,
    originalPrice: numericOriginalPrice > 0 ? numericOriginalPrice : undefined,
    discountPercent: getFirstValue(
      source?.discountPercent,
      source?.discount_percent,
      source?.discount_percentage,
      computedDiscountPercent,
    ),
    rating: getFirstValue(source?.rating, source?.averageRating, source?.average_rating, 5),
    image,
    imageUrl: image,
    imageSrc: image,
    thumbnail: image,
    images: productImages.length ? productImages : image ? [image] : [],
    categoryIdx,
    variants: Array.isArray(source?.variants) ? source.variants.map(normalizeVariant) : [],
    variantId: source?.variants?.[0]?.id || source?.variants?.[0]?._id || null,
    totalStock: toNumber(getFirstValue(source?.totalStock, source?.stockQuantity, source?.stock_quantity, 0)),
    outOfStock: Boolean(source?.outOfStock || (source?.totalStock !== undefined && Number(source?.totalStock) <= 0)),
    availableStock: toNumber(getFirstValue(source?.availableStock, source?.totalStock, source?.stockQuantity, 0)),
    stockQuantity: getFirstValue(source?.stockQuantity, source?.stock_quantity, source?.totalStock, 0),
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
      totalRows: Number(payload?.totalRows ?? payload?.total ?? payload?.totalItems ?? products.length),
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
        targetType: "PRODUCT",
        targetId: String(productId),
        rating: Number(payload.rating || 5),
        comment: payload.comment ?? payload.content ?? payload.review ?? "",
        anonymous: Boolean(payload.anonymous),
      }),
    );
  }
}

import { inject, Injectable } from '@angular/core';

import { ProductApiService } from './api/product-api.service';
import { filterByTerms } from './smart-search';

/**
 * CHỈ MỤC TÌM KIẾM SẢN PHẨM PHÍA FE (Nhiệm vụ 11 — tìm cả trong MÔ TẢ sản phẩm).
 *
 * Vì sao cần: backend /search phân biệt dấu ("tieu hoa" không ra "tiêu hóa"),
 * /search/suggestions chỉ tìm theo tên (gõ "stress" -> 0 gợi ý dù mô tả có).
 * => FE tải gọn danh sách sản phẩm (id, tên, danh mục, mô tả, giá, ảnh) 1 lần / phiên,
 *    tìm không dấu trên tên + danh mục + MÔ TẢ, rồi gộp với kết quả backend.
 *
 * Giới hạn: chỉ bật khi catalog <= MAX_INDEXED_PRODUCTS (hiện 122 sản phẩm). Lớn hơn thì tắt,
 * dùng hoàn toàn backend (xem docs/BE-PROPOSAL-TASK-11-14.md, mục P2).
 */
const PAGE_SIZE = 100;
const MAX_INDEXED_PRODUCTS = 600;
const CACHE_KEY = 'drPetProductSearchIndex';
const CACHE_TTL_MS = 10 * 60 * 1000;

/** Chỉ giữ các trường cần để tìm & hiển thị — catalog gốc ~950KB, bản gọn ~10% */
const INDEXED_FIELDS = [
  'id', 'productCode', 'name', 'description', 'categoryId', 'categoryName', 'price', 'originalPrice',
  'discountPercent', 'image', 'images', 'rating', 'reviewCount', 'totalStock', 'outOfStock', 'createdAt',
] as const;

interface CachedIndex {
  savedAt: number;
  products: any[];
}

function slim(product: any) {
  const result: Record<string, unknown> = {};
  for (const field of INDEXED_FIELDS) {
    if (product?.[field] !== undefined) result[field] = field === 'images' ? (product.images ?? []).slice(0, 1) : product[field];
  }
  return result;
}

@Injectable({ providedIn: 'root' })
export class ProductSearchIndexService {
  private readonly productApi = inject(ProductApiService);
  private products: any[] | null = this.readCache();
  private loading: Promise<any[]> | null = null;

  /** Tải chỉ mục ở nền (gọi khi người dùng bấm vào ô tìm kiếm) — không chặn giao diện. */
  warmUp(): void {
    void this.ensureLoaded();
  }

  /** Sản phẩm khớp tên / danh mục / mô tả, đã xếp hạng. Lỗi tải -> [] (vẫn còn kết quả backend). */
  async search(terms: string[], limit = 50): Promise<any[]> {
    const products = await this.ensureLoaded();
    return filterByTerms(products, terms, 'product').slice(0, limit);
  }

  /** Như search() nhưng KHÔNG chờ tải: chỉ dùng khi chỉ mục đã sẵn (cho dropdown gõ tới đâu gợi ý tới đó). */
  searchIfReady(terms: string[], limit = 10): any[] {
    if (!this.products) {
      this.warmUp();
      return [];
    }
    return filterByTerms(this.products, terms, 'product').slice(0, limit);
  }

  private ensureLoaded(): Promise<any[]> {
    if (this.products) return Promise.resolve(this.products);
    if (!this.loading) {
      this.loading = this.loadAll()
        .then((products) => {
          this.products = products;
          this.writeCache(products);
          return products;
        })
        .catch(() => [])
        .finally(() => {
          this.loading = null;
        });
    }
    return this.loading;
  }

  private async loadAll(): Promise<any[]> {
    const first = await this.productApi.getProductsPage({ page: 1, limit: PAGE_SIZE });
    // Catalog quá lớn -> không tải hết về trình duyệt
    if (first.totalRows > MAX_INDEXED_PRODUCTS) return [];
    const totalPages = Math.min(first.totalPages || 1, Math.ceil(MAX_INDEXED_PRODUCTS / PAGE_SIZE));
    const rest = await Promise.all(
      Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) =>
        this.productApi.getProductsPage({ page: index + 2, limit: PAGE_SIZE }).then((page) => page.products),
      ),
    );
    return [...first.products, ...rest.flat()].filter((product) => product?.id).map(slim);
  }

  private readCache(): any[] | null {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null') as CachedIndex | null;
      return cached && Date.now() - cached.savedAt < CACHE_TTL_MS && Array.isArray(cached.products) ? cached.products : null;
    } catch {
      return null;
    }
  }

  private writeCache(products: any[]): void {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), products } satisfies CachedIndex));
    } catch {
      // sessionStorage đầy / bị chặn -> chỉ giữ trong bộ nhớ
    }
  }
}

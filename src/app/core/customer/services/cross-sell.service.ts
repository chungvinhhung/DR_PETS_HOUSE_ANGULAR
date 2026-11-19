import { inject, Injectable } from '@angular/core';

import { ProductApiService } from './api/product-api.service';
import { buildProductPath } from '../../../shared/customer/utils/slug';
import { detectPet, foldText, sortByPetAffinity } from './smart-search';

/**
 * GỢI Ý BÁN CHÉO (Nhiệm vụ 11).
 *
 * Nguồn gợi ý = kết hợp 2 tầng:
 *  1. Backend: GET /products/:id/related (sản phẩm liên quan của sản phẩm khớp nhất).
 *  2. Luật bán chéo theo danh mục (bên dưới): mua Thức ăn -> gợi ý Đồ dùng (bát ăn), Chăm sóc sức khỏe...
 * Sau đó: loại sản phẩm đã có trong kết quả, ưu tiên đúng loài thú cưng đang tìm (mèo/chó),
 * xen kẽ giữa các danh mục để gợi ý đa dạng.
 *
 * Danh mục được so khớp theo TÊN không dấu (không phụ thuộc id) nên vẫn đúng khi backend thêm/đổi danh mục.
 */
interface CrossSellRule {
  /** Danh mục gốc (tên không dấu chứa 1 trong các từ này) */
  when: string[];
  /** Danh mục nên gợi ý kèm */
  suggest: string[];
  reason: string;
  service?: CrossSellServiceLink;
}

/** Dịch vụ phòng khám gợi ý kèm (bán chéo sản phẩm -> dịch vụ). */
export interface CrossSellServiceLink {
  label: string;
  href: string;
  description: string;
}

export interface CrossSellResult {
  products: any[];
  services: CrossSellServiceLink[];
}

const GROOMING_SERVICE: CrossSellServiceLink = {
  label: 'Grooming & Spa',
  href: '/dich-vu/grooming-spa',
  description: 'Tắm, cắt tỉa lông chuyên nghiệp cho bé',
};

const MEDICAL_SERVICE: CrossSellServiceLink = {
  label: 'Khám & điều trị',
  href: '/dich-vu/kham-dieu-tri',
  description: 'Tư vấn dinh dưỡng, khám sức khỏe định kỳ',
};

export const CROSS_SELL_RULES: CrossSellRule[] = [
  { when: ['thuc an', 'dinh duong'], suggest: ['do dung thiet yeu', 'phu kien', 'cham soc suc khoe'], reason: 'Thường mua kèm thức ăn', service: MEDICAL_SERVICE },
  { when: ['do choi', 'huan luyen'], suggest: ['thuc an', 'phu kien'], reason: 'Thường mua kèm đồ chơi' },
  { when: ['cham soc', 've sinh', 'suc khoe'], suggest: ['do dung thiet yeu', 'thuc an'], reason: 'Bộ chăm sóc trọn gói', service: GROOMING_SERVICE },
  { when: ['phu kien', 'chuong'], suggest: ['do choi', 'do dung thiet yeu'], reason: 'Hoàn thiện góc của bé' },
  { when: ['do dung thiet yeu'], suggest: ['cham soc', 'do choi'], reason: 'Thường mua kèm đồ dùng' },
];

const MAX_SUGGESTED_CATEGORIES = 2;
const PER_CATEGORY_LIMIT = 12;

function getId(product: any): string {
  return String(product?.id ?? product?.productId ?? '');
}

function categoryNameOf(category: any): string {
  return category?.name ?? category?.categoryName ?? category?.category_name ?? '';
}

function categoryIdOf(category: any): string {
  return String(category?.id ?? category?._id ?? category?.categoryId ?? category?.category_id ?? '');
}

/** Tìm luật áp dụng cho 1 tên danh mục. */
export function findCrossSellRule(categoryName: unknown): CrossSellRule | undefined {
  const folded = foldText(categoryName);
  if (!folded) return undefined;
  return CROSS_SELL_RULES.find((rule) => rule.when.some((keyword) => folded.includes(keyword)));
}

@Injectable({ providedIn: 'root' })
export class CrossSellService {
  private readonly productApi = inject(ProductApiService);
  private categories$: Promise<any[]> | null = null;

  /**
   * @param seedProducts sản phẩm khớp tìm kiếm (đã xếp hạng) — 3 cái đầu làm "hạt giống"
   * @param pet          loài thú cưng trong câu tìm kiếm (null nếu không có)
   */
  async suggest(seedProducts: any[], { pet = null as string | null, limit = 8, excludeIds = [] as string[] } = {}): Promise<CrossSellResult> {
    const seeds = (seedProducts ?? []).filter((product) => getId(product)).slice(0, 3);
    if (!seeds.length) return { products: [], services: [] };

    const exclude = new Set([...excludeIds, ...(seedProducts ?? []).map(getId)]);
    const targetPet = pet ?? this.detectPet(seeds);

    const seedCategoryNames = Array.from(new Set(seeds.map((product) => product.categoryName).filter(Boolean)));
    const rules = seedCategoryNames.map(findCrossSellRule).filter((rule): rule is CrossSellRule => Boolean(rule));
    const seedFolded = seedCategoryNames.map(foldText);

    const categories = await this.getCategories();
    const suggestedCategories = Array.from(new Set(rules.flatMap((rule) => rule.suggest)))
      .flatMap((keyword) => categories.filter((category) => foldText(categoryNameOf(category)).includes(keyword)))
      // Không gợi ý lại đúng danh mục đang xem
      .filter((category) => !seedFolded.includes(foldText(categoryNameOf(category))))
      .filter((category, index, list) => list.findIndex((item) => categoryIdOf(item) === categoryIdOf(category)) === index)
      .slice(0, MAX_SUGGESTED_CATEGORIES);

    const [related, ...byCategory]: any[][] = await Promise.all([
      this.productApi.getSimilarProducts(getId(seeds[0]), PER_CATEGORY_LIMIT).catch(() => []),
      ...suggestedCategories.map((category) =>
        this.productApi
          .getProducts({ categoryId: categoryIdOf(category), sort: 'best_selling', limit: PER_CATEGORY_LIMIT, page: 1 })
          .catch(() => []),
      ),
    ]);

    const reasonFor = (product: any) => {
      const rule = rules[0];
      return byCategory.some((list) => list.includes(product)) && rule ? rule.reason : 'Khách hàng khác cũng xem';
    };

    // Danh sách bán chéo theo danh mục đặt trước "related" vì related của backend thường cùng danh mục
    const pools = [...byCategory, related].map((list) =>
      sortByPetAffinity(list.filter((product: any) => !exclude.has(getId(product)) && !product.outOfStock), targetPet),
    );

    const products = this.interleave(pools, limit).map((product) => ({
      ...product,
      href: buildProductPath(product),
      crossSellReason: reasonFor(product),
    }));

    const services = Array.from(new Map(rules.filter((rule) => rule.service).map((rule) => [rule.service!.href, rule.service!])).values());

    return { products, services };
  }

  private getCategories(): Promise<any[]> {
    if (!this.categories$) {
      this.categories$ = this.productApi.getProductCategories().catch(() => {
        this.categories$ = null;
        return [];
      });
    }
    return this.categories$;
  }

  private detectPet(products: any[]): string | null {
    return detectPet(products.map((product) => product.name).join(' '));
  }

  /** Lấy lần lượt từ mỗi nhóm để gợi ý đa dạng danh mục. */
  private interleave(pools: any[][], limit: number): any[] {
    const result: any[] = [];
    const seen = new Set<string>();
    for (let round = 0; result.length < limit && pools.some((pool) => pool.length > round); round += 1) {
      for (const pool of pools) {
        const product = pool[round];
        if (!product || seen.has(getId(product))) continue;
        seen.add(getId(product));
        result.push(product);
        if (result.length >= limit) break;
      }
    }
    return result;
  }
}

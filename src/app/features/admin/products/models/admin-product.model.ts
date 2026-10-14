/** OpenAPI v7 product contract. Stock is managed by Inventory, not Product. */
export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type VariantStatus = 'ACTIVE' | 'INACTIVE';

export interface ProductVariantWrite {
  id?: string;
  sku: string;
  label: string;
  price: number;
  status: VariantStatus;
}

export interface ProductWrite {
  name: string;
  description: string;
  categoryId: string;
  /** Publicly reachable image URLs; upload endpoint is not yet available. */
  images?: string[];
  variants: ProductVariantWrite[];
  status: Exclude<ProductStatus, 'ARCHIVED'>;
}

export interface ProductVariant extends ProductVariantWrite {
  id: string;
}

export interface AdminProduct extends Omit<ProductWrite, 'variants' | 'status'> {
  id: string;
  variants: ProductVariant[];
  status: ProductStatus;
  images: string[];
  outOfStock: boolean;
}

/** Backend OpenAPI v7 uses cursor-based pagination, not numbered pages. */
export interface ProductPageResponse {
  items: AdminProduct[];
  nextCursor: string | null;
  /** Optional: not yet supplied by BE OpenAPI v7. */
  totalItems?: number;
  /** Compatibility with potential older API total names. */
  totalCount?: number;
  total?: number;
}

export type ProductSort = 'NEWEST' | 'NAME_ASC' | 'NAME_DESC' | 'PRICE_ASC' | 'PRICE_DESC';

export interface ProductQuery {
  q?: string;
  categoryId?: string;
  status?: ProductStatus;
  sort?: ProductSort;
  limit?: number;
  cursor?: string | null;
}

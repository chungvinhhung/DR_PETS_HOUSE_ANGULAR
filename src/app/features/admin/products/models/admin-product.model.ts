/** OpenAPI v7 product contract. Stock is managed by Inventory, not Product. */
export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type VariantStatus = 'ACTIVE' | 'INACTIVE';

export interface ProductVariantWrite {
  sku: string;
  label: string;
  price: number;
  status: VariantStatus;
}

export interface ProductWrite {
  name: string;
  description: string;
  categoryId: string;
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

/**
 * Chuyển từ React: src/services/cartService.js
 *
 * - Các hàm "normalize..." / tiện ích không gọi API: giữ nguyên là hàm export (thuần, dùng được ở mọi nơi).
 * - Các hàm async gọi API: gom vào class CartApiService (inject vào component).
 *   Gọi HTTP qua CustomerHttpService (bọc ApiClientService của core) -> trả về Promise như axios cũ.
 */
import { Injectable, inject } from '@angular/core';

import { CustomerHttpService, assertSuccess } from '../customer-http.service';

function getPrimaryProductImage(product: any = {}) {
  const primaryImage = Array.isArray(product.product_images)
    ? product.product_images.find((image: any) => image.is_primary) || product.product_images[0]
    : null;

  return product.thumbnail_url || product.image_url || primaryImage?.image_url || null;
}

export function normalizeCartItem(item: any = {}) {
  const product = item.product || {};
  const variant = item.variant || item.product_variant || {};
  const productId = item.product_id ?? product.product_id ?? item.productId ?? product.id;
  const variantId = item.variant_id ?? variant.variant_id ?? item.variantId ?? variant.id ?? null;
  const cartItemId = item.cart_item_id ?? item.cartItemId ?? item.id ?? item._id;
  const price = variant.finalPrice ?? variant.price ?? product.finalPrice ?? product.price ?? item.price ?? 0;

  return {
    id: String(cartItemId ?? `${productId}:${variantId || "default"}`),
    cartItemId,
    productId,
    variantId,
    name: product.product_name ?? product.name ?? item.name ?? "",
    price: Number(price),
    image: getPrimaryProductImage(product) || item.image || item.imageUrl || item.thumbnail || product.thumbnailUrl || product.imageUrl,
    type: variant.variant_name ?? variant.label ?? variant.name ?? item.type ?? "",
    size: item.size ?? "",
    variants: Array.isArray(product.variants) ? product.variants : item.variants,
    qty: Number(item.quantity ?? item.qty ?? 1),
    selected: Boolean(item.is_selected ?? item.isSelected ?? item.selected ?? true),
    raw: item,
  };
}

@Injectable({ providedIn: 'root' })
export class CartApiService {
  private readonly http = inject(CustomerHttpService);

  async getCart() {
    try {
      const response = await this.http.get("/cart");
      const cart = assertSuccess(response);
      const items = Array.isArray(cart?.items)
        ? cart.items
        : Array.isArray(cart?.cart_items)
          ? cart.cart_items
          : Array.isArray(cart)
            ? cart
            : [];
      const validItems = items
        .map(normalizeCartItem)
        .filter((item: any) => Boolean(item && item.name && item.name.trim() && item.name !== 'Sản phẩm' && item.productId));
      return {
        ...cart,
        items: validItems,
      };
    } catch {
      return { items: [] };
    }
  }

  async addCartItem(item: any) {
    let variantId = item.variantId || item.variant_id || null;
    if (!variantId && Array.isArray(item.variants) && item.variants.length > 0) {
      variantId = item.variants[0]?.id || item.variants[0]?._id || item.variants[0]?.variantId || null;
    }
    const payload = {
      productId: item.productId || item.product_id || item.id,
      variantId,
      size: item.size || "",
      quantity: Number(item.qty || item.quantity || 1),
    };
    try {
      const response = await this.http.post("/cart", payload);
      return normalizeCartItem(assertSuccess(response));
    } catch {
      const response = await this.http.post("/cart", {
        product_id: payload.productId,
        variant_id: payload.variantId,
        quantity: payload.quantity,
      });
      return normalizeCartItem(assertSuccess(response));
    }
  }

  async updateCartItem(itemId: any, updates: any) {
    const payload: any = {};
    if (updates.quantity !== undefined) payload.quantity = updates.quantity;
    if (updates.variantId !== undefined) payload.variant_id = updates.variantId;
    if (updates.variant_id !== undefined) payload.variant_id = updates.variant_id;
    if (updates.size !== undefined) payload.size = updates.size;
    if (updates.isSelected !== undefined) payload.is_selected = updates.isSelected;
    if (updates.is_selected !== undefined) payload.is_selected = updates.is_selected;
  
    const response = await this.http.put(`/cart/${itemId}`, payload);
    const data = assertSuccess(response);
    return data ? normalizeCartItem(data) : null;
  }

  async deleteCartItem(itemId: any) {
    const response = await this.http.delete(`/cart/${itemId}`);
    return assertSuccess(response);
  }
}

import { HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from '../../../../core/services/api-client.service';
import { AdminProduct, ProductPageResponse } from '../../products/models/admin-product.model';

/** Existing BE /customers DTO. No address field is returned by this contract. */
export interface OrderCustomerLookup {
  id: string;
  fullName?: string | null;
  phone?: string | null;
  email?: string | null;
  activationStatus?: 'NO_ACCOUNT' | 'PENDING_ACTIVATION' | 'ACTIVATED';
  accountStatus?: 'ACTIVE' | 'BLOCKED' | null;
}

export interface OrderCustomerLookupResponse {
  items: OrderCustomerLookup[];
  nextCursor: string | null;
}

@Injectable({ providedIn: 'root' })
export class AdminOrderCreateLookupService {
  private readonly api = inject(ApiClientService);

  /** Backend now supports exactPhone server-side. FE also verifies normalized phones. */
  searchCustomers(phone: string): Observable<OrderCustomerLookupResponse> {
    return this.api.get<OrderCustomerLookupResponse>('/customers', {
      params: new HttpParams().set('exactPhone', phone.trim()).set('limit', '100'),
    });
  }

  /** Existing product-catalog search; omit q until the user enters a keyword.
   *  Sending q="" triggers request validation in some deployed BE versions.
   */
  searchProducts(nameOrSku: string): Observable<ProductPageResponse> {
    const keyword = nameOrSku.trim();
    let params = new HttpParams()
      .set('status', 'ACTIVE')
      .set('limit', '100');
    if (keyword) params = params.set('q', keyword);
    return this.api.get<ProductPageResponse>('/products', { params });
  }

  /** Unifies results in the UI without manufacturing prices or stock values. */
  saleVariants(product: AdminProduct) {
    if (product.status !== 'ACTIVE' || !['SALE', 'SHARED'].includes(product.usageType)) return [];
    return product.variants
      .filter(variant => variant.status === 'ACTIVE' &&
        Number.isFinite(variant.finalPrice) && variant.finalPrice >= 0)
      .map(variant => ({
        productId: product.id,
        variantId: variant.id,
        productName: product.name,
        sku: variant.sku,
        label: variant.label,
        price: variant.finalPrice,
        availableStock: variant.availableStock,
        imageUrl: variant.image || product.images.find(image => image.isPrimary)?.url
          || product.images[0]?.url || undefined,
      }));
  }
}

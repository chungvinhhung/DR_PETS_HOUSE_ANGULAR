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

  /**
   * Search the existing customer API by phone. The caller must match the
   * normalized phone exactly, because BE currently searches phones *and*
   * emails with a partial search regex.
   */
  searchCustomers(phone: string): Observable<OrderCustomerLookupResponse> {
    return this.api.get<OrderCustomerLookupResponse>('/customers', {
      params: new HttpParams().set('search', phone.trim()).set('limit', '100'),
    });
  }

  /** Existing product-catalog search; the UI can filter active sale variants. */
  searchProducts(nameOrSku: string): Observable<ProductPageResponse> {
    return this.api.get<ProductPageResponse>('/products', {
      params: new HttpParams()
        .set('q', nameOrSku.trim())
        .set('status', 'ACTIVE')
        .set('limit', '100'),
    });
  }

  /** Unifies results in the UI without manufacturing prices or stock values. */
  saleVariants(product: AdminProduct) {
    if (product.status !== 'ACTIVE' || !['SALE', 'SHARED'].includes(product.usageType)) return [];
    return product.variants
      .filter(variant => variant.status === 'ACTIVE')
      .map(variant => ({
        productId: product.id,
        variantId: variant.id,
        productName: product.name,
        sku: variant.sku,
        label: variant.label,
        price: variant.finalPrice,
        availableStock: variant.availableStock,
      }));
  }
}

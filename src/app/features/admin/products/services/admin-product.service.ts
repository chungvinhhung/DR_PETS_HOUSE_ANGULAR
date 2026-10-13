import { HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '../../../../core/services/api-client.service';
import { AdminProduct, ProductPageResponse, ProductQuery, ProductWrite } from '../models/admin-product.model';

@Injectable({ providedIn: 'root' })
export class AdminProductService {
  private readonly api = inject(ApiClientService);

  listProducts(query: ProductQuery = {}): Observable<ProductPageResponse> {
    let params = new HttpParams().set('limit', String(query.limit ?? 20));
    if (query.q?.trim()) params = params.set('q', query.q.trim());
    if (query.categoryId) params = params.set('categoryId', query.categoryId);
    if (query.status) params = params.set('status', query.status);
    if (query.sort) params = params.set('sort', query.sort);
    if (query.cursor) params = params.set('cursor', query.cursor);
    return this.api.get<ProductPageResponse>('/products', { params });
  }

  getProduct(id: string): Observable<AdminProduct> {
    return this.api.get<AdminProduct>('/products/' + encodeURIComponent(id));
  }

  updateProduct(id: string, body: Partial<ProductWrite>): Observable<AdminProduct> {
    return this.api.patch<AdminProduct, Partial<ProductWrite>>(
      '/products/' + encodeURIComponent(id), body,
    );
  }

  createProduct(body: ProductWrite, idempotencyKey: string): Observable<AdminProduct> {
    // Preserve the same key across retries of the same draft. Generating a
    // fresh key after a network timeout could create a duplicate Product.
    const headers = new HttpHeaders({ 'Idempotency-Key': idempotencyKey });
    return this.api.post<AdminProduct, ProductWrite>('/products', body, { headers });
  }
}

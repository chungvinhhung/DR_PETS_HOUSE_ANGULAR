import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

import { ApiClientService } from '../../../../core/services/api-client.service';
import { AdminProduct, ProductPageResponse, ProductQuery, ProductUploadResponse, ProductWrite } from '../models/admin-product.model';

@Injectable({ providedIn: 'root' })
export class AdminProductService {
  private readonly api = inject(ApiClientService);
  private readonly http = inject(HttpClient);

  listProducts(query: ProductQuery = {}): Observable<ProductPageResponse> {
    let params = new HttpParams().set('limit', String(query.limit ?? 20));
    if (query.q?.trim()) params = params.set('q', query.q.trim());
    if (query.categoryId) params = params.set('categoryId', query.categoryId);
    if (query.usageType) params = params.set('usageType', query.usageType);
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

  /** Upload image bytes; never override multipart boundary manually. */
  uploadImages(files: File[]): Observable<ProductUploadResponse> {
    const form = new FormData();
    for (const file of files) form.append('files', file, file.name);
    return this.http.post<ProductUploadResponse>(
      environment.apiBaseUrl.replace(/\/+$/, '') + '/uploads/products',
      form, { withCredentials: true },
    );
  }

  restoreProduct(id: string, key: string): Observable<AdminProduct> {
    const headers = new HttpHeaders({ 'Idempotency-Key': key });
    return this.api.post<AdminProduct, Record<string, never>>(
      '/products/' + encodeURIComponent(id) + '/restore', {}, { headers },
    );
  }

  archiveProduct(id: string, idempotencyKey: string): Observable<AdminProduct> {
    const headers = new HttpHeaders({ 'Idempotency-Key': idempotencyKey });
    return this.api.post<AdminProduct, Record<string, never>>(
      '/products/' + encodeURIComponent(id) + '/archive', {}, { headers },
    );
  }

  createProduct(body: ProductWrite, idempotencyKey: string): Observable<AdminProduct> {
    // Preserve the same key across retries of the same draft. Generating a
    // fresh key after a network timeout could create a duplicate Product.
    const headers = new HttpHeaders({ 'Idempotency-Key': idempotencyKey });
    return this.api.post<AdminProduct, ProductWrite>('/products', body, { headers });
  }
}

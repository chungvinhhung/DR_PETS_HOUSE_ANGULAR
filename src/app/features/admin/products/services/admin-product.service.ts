import { HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '../../../../core/services/api-client.service';
import { AdminProduct, ProductWrite } from '../models/admin-product.model';

@Injectable({ providedIn: 'root' })
export class AdminProductService {
  private readonly api = inject(ApiClientService);

  createProduct(body: ProductWrite): Observable<AdminProduct> {
    // POST /products is idempotent according to the BE's OpenAPI v7 contract.
    const headers = new HttpHeaders({ 'Idempotency-Key': crypto.randomUUID() });
    return this.api.post<AdminProduct, ProductWrite>('/products', body, { headers });
  }
}

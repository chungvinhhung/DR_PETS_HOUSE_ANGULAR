import { HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiClientService } from '../../../../core/services/api-client.service';
import { AdminProduct, ProductWrite } from '../models/admin-product.model';

@Injectable({ providedIn: 'root' })
export class AdminProductService {
  private readonly api = inject(ApiClientService);

  createProduct(body: ProductWrite, idempotencyKey: string): Observable<AdminProduct> {
    // Preserve the same key across retries of the same draft. Generating a
    // fresh key after a network timeout could create a duplicate Product.
    const headers = new HttpHeaders({ 'Idempotency-Key': idempotencyKey });
    return this.api.post<AdminProduct, ProductWrite>('/products', body, { headers });
  }
}

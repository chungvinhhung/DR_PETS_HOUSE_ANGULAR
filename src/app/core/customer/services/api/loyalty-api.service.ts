/**
 * Chuyển từ React: src/services/loyaltyService.js
 *
 * - Các hàm "normalize..." / tiện ích không gọi API: giữ nguyên là hàm export (thuần, dùng được ở mọi nơi).
 * - Các hàm async gọi API: gom vào class LoyaltyApiService (inject vào component).
 *   Gọi HTTP qua CustomerHttpService (bọc ApiClientService của core) -> trả về Promise như axios cũ.
 */
import { Injectable, inject } from '@angular/core';

import { CustomerHttpService } from '../customer-http.service';

function assertSuccess(response: any) {
  if (response?.EC !== 0) {
    throw new Error(response?.EM || "Request failed");
  }
  return response.DT;
}

@Injectable({ providedIn: 'root' })
export class LoyaltyApiService {
  private readonly http = inject(CustomerHttpService);

  async applyVoucher({ code, orderValue }: any) {
    const response = await this.http.post("/vouchers/apply", {
      code,
      order_value: orderValue,
    });
    return assertSuccess(response);
  }
}

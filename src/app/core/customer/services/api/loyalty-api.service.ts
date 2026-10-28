/**
 * Chuyển từ React: src/services/loyaltyService.js
 *
 * - Các hàm "normalize..." / tiện ích không gọi API: giữ nguyên là hàm export (thuần, dùng được ở mọi nơi).
 * - Các hàm async gọi API: gom vào class LoyaltyApiService (inject vào component).
 *   Gọi HTTP qua CustomerHttpService (bọc ApiClientService của core) -> trả về Promise như axios cũ.
 */
import { Injectable, inject } from '@angular/core';

import { CustomerHttpService, assertSuccess } from '../customer-http.service';

@Injectable({ providedIn: 'root' })
export class LoyaltyApiService {
  private readonly http = inject(CustomerHttpService);

  async applyVoucher({ code, orderValue, branchId }: any) {
    try {
      const response = await this.http.post("/vouchers/validate", {
        code,
        scope: "ORDER",
        branchId: branchId || undefined,
      });
      const data = assertSuccess(response);
      return {
        ...data,
        discount: data?.discount ?? data?.discount_amount ?? 0,
        valid: data?.valid ?? true,
        reason: data?.reason ?? "",
      };
    } catch {
      const response = await this.http.post("/vouchers/apply", {
        code,
        order_value: orderValue,
      });
      return assertSuccess(response);
    }
  }
}

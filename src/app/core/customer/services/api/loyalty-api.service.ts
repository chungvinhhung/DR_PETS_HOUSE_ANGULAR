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

  async applyVoucher({ code, orderValue, branchId, serviceIds, cartId }: any) {
    const formattedCode = String(code || "").trim().toUpperCase();
    const scope = serviceIds && serviceIds.length > 0 ? "SERVICE" : "ORDER";
    try {
      const response = await this.http.post("/vouchers/validate", {
        code: formattedCode,
        scope,
        branchId: branchId || undefined,
        cartId: cartId || undefined,
        serviceIds: serviceIds || undefined,
      });
      const data = assertSuccess(response);
      const discount = data?.discount ?? data?.discount_amount ?? data?.discountValue ?? data?.discountAmount ?? 0;
      return {
        ...data,
        discount,
        discountAmount: discount,
        valid: data?.valid ?? true,
        reason: data?.reason ?? "",
      };
    } catch {
      const response = await this.http.post("/vouchers/apply", {
        code: formattedCode,
        scope,
        branchId: branchId || undefined,
      });
      return assertSuccess(response);
    }
  }
}

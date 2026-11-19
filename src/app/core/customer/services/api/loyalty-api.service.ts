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
    const scope = Array.isArray(serviceIds) && serviceIds.length > 0 ? "SERVICE" : "ORDER";
    // Service vouchers must be checked with actual selected services. An
    // invalid response is final: /apply is only an alias of /validate, not
    // permission to try the wrong scope or to award a local fake discount.
    if (scope === "SERVICE") {
      const response = await this.http.post("/vouchers/validate", {
        code: formattedCode,
        scope: "SERVICE",
        serviceIds: [...new Set(serviceIds.map((id: unknown) => String(id).trim()).filter(Boolean))],
        branchId: branchId || undefined,
      });
      const data = assertSuccess(response);
      if (data?.valid !== true) {
        throw new Error(String(data?.reason || "VOUCHER_INVALID"));
      }
      const discount = Number(data?.discount ?? 0);
      if (!Number.isFinite(discount) || discount <= 0) {
        throw new Error("DISCOUNT_NOT_AVAILABLE");
      }
      return {...data, discount, discountAmount: discount};
    }
    try {
      const response = await this.http.post("/vouchers/validate", {
        code: formattedCode,
        scope,
        branchId: branchId || undefined,
        cartId: cartId || undefined,
        serviceIds: serviceIds || undefined,
      });
      const data = assertSuccess(response);
      if (data && data.valid === false) {
        throw new Error(data?.reason || "Mã không tồn tại");
      }
      const discount = data?.discount ?? data?.discount_amount ?? data?.discountValue ?? 0;
      return {
        ...data,
        discount,
        discountAmount: discount,
      };
    } catch (err: any) {
      if (err?.message === "Mã không tồn tại" || err?.message === "NOT_FOUND" || err?.message === "INACTIVE" || err?.message === "EXPIRED") {
        throw err;
      }
      const response = await this.http.post("/vouchers/apply", {
        code: formattedCode,
        scope,
        branchId: branchId || undefined,
      });
      const fallback = assertSuccess(response);
      const discount = fallback?.discount ?? fallback?.discount_amount ?? fallback?.discountValue ?? 0;
      return {
        ...fallback,
        discount,
        discountAmount: discount,
      };
    }
  }
}

/**
 * Chuyển từ React: src/services/servicePricingService.js
 *
 * - Các hàm "normalize..." / tiện ích không gọi API: giữ nguyên là hàm export (thuần, dùng được ở mọi nơi).
 * - Các hàm async gọi API: gom vào class ServicePricingApiService (inject vào component).
 *   Gọi HTTP qua CustomerHttpService (bọc ApiClientService của core) -> trả về Promise như axios cũ.
 */
import { Injectable, inject } from '@angular/core';

import { CustomerHttpService, assertSuccess } from '../customer-http.service';

const iconByServiceName = [
  [/tắm|sấy/i, "bath", "#2d63c8", "#cce1fe"],
  [/massage/i, "sprout", "#00c7a2", "#cffff5"],
  [/cắt|tỉa|móng/i, "scissors", "#08a8e8", "#d0e9ff"],
  [/ký sinh|ve|bọ/i, "bug", "#8b5cf6", "#efd8ff"],
  [/nhuộm/i, "palette", "#ff2bbb", "#ffe0f1"],
  [/răng|miệng/i, "tooth", "#f59e0b", "#fff2dc"],
  [/khám|điều trị/i, "stethoscope", "#2d63c8", "#cce1fe"],
  [/xét nghiệm/i, "flask", "#00c7a2", "#cffff5"],
  [/siêu âm/i, "heartPulse", "#ff2bbb", "#ffe0f1"],
  [/tiêm|vaccine|phòng/i, "syringe", "#d99a16", "#ffffdf"],
  [/phẫu thuật/i, "scalpel", "#8b5cf6", "#ecd8ff"],
  [/cấp cứu/i, "siren", "#ef4444", "#ffd8d8"],
];

function classifyCategory(categoryName: any = "") {
  if (/combo/i.test(categoryName)) return "combo";
  if (/groom|spa|tắm|cắt/i.test(categoryName)) return "grooming";
  return "medical";
}

function formatPrice(value: any, isContact: any) {
  if (isContact || value === null || value === undefined) return "Liên hệ";
  const number = Number(value);
  if (!Number.isFinite(number)) return "Liên hệ";
  if (number >= 1000) return `${Math.round(number / 1000)}k`;
  return `${number}k`;
}

function getServiceVisual(serviceName: any = "") {
  const matched = iconByServiceName.find(([pattern]: any) => pattern.test(serviceName));
  if (!matched) return { icon: "sparkles", iconColor: "#d99a16", background: "#fffbdc" };
  return { icon: matched[1], iconColor: matched[2], background: matched[3] };
}

function normalizeCategory(category: any = {}) {
  const value = classifyCategory(category.category_name);
  const columns = (category.weight_ranges || []).map((range: any, index: any) => ({
    label: range.label,
    tone: index < 3 ? "primary" : index < 6 ? "secondary" : "info",
  }));

  return {
    value,
    label: category.category_name,
    columns,
    rows: (category.services || []).map((service: any) => {
      const visual = getServiceVisual(service.service_name);
      return {
        title: service.service_name,
        ...visual,
        prices: (service.prices || []).map((item: any) => formatPrice(item.price, item.is_contact)),
      };
    }),
  };
}

@Injectable({ providedIn: 'root' })
export class ServicePricingApiService {
  private readonly http = inject(CustomerHttpService);

  async getServicePricingMatrix() {
    try {
      const response = await this.http.get("/services/pricing-matrix");
      const data = assertSuccess(response);
      const list = Array.isArray(data) ? data : Array.isArray(data?.categories) ? data.categories : [];
      const categories = list.map(normalizeCategory);
    
      return categories.reduce(
        (result: any, category: any) => ({
          ...result,
          [category.value]: {
            label: category.label,
            columns: category.columns,
            rows: [...((result as any)[category.value]?.rows || []), ...category.rows],
          },
        }),
        {},
      );
    } catch {
      return {};
    }
  }
}

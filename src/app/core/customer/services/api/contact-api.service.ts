/**
 * Chuyển từ React: src/services/contactService.js
 *
 * - Các hàm "normalize..." / tiện ích không gọi API: giữ nguyên là hàm export (thuần, dùng được ở mọi nơi).
 * - Các hàm async gọi API: gom vào class ContactApiService (inject vào component).
 *   Gọi HTTP qua CustomerHttpService (bọc ApiClientService của core) -> trả về Promise như axios cũ.
 */
import { Injectable, inject } from '@angular/core';

import { CustomerHttpService, assertSuccess } from '../customer-http.service';

@Injectable({ providedIn: 'root' })
export class ContactApiService {
  private readonly http = inject(CustomerHttpService);

  async submitContactMessage(data: any) {
    try {
      // Customer Liên hệ fields: name, gender, phone, email, message.
      // BE /feedback requires subject, but the Customer form has no subject
      // input. Supply a truthful form source label, not a fabricated user title.
      const response = await this.http.post('/feedback', {
        name: String(data?.name || '').trim(),
        gender: data?.gender || undefined, // Pending BE schema support.
        phone: String(data?.phone || '').trim(),
        email: String(data?.email || '').trim(),
        subject: 'Liên hệ từ website',
        category: 'GENERAL',
        message: String(data?.message || '').trim(),
      });
      return assertSuccess(response);
    } catch (error: any) {
      console.error('Lỗi khi gửi thông điệp liên hệ:', error);
      throw error;
    }
  }
}

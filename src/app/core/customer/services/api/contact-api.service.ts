/**
 * Chuyển từ React: src/services/contactService.js
 *
 * - Các hàm "normalize..." / tiện ích không gọi API: giữ nguyên là hàm export (thuần, dùng được ở mọi nơi).
 * - Các hàm async gọi API: gom vào class ContactApiService (inject vào component).
 *   Gọi HTTP qua CustomerHttpService (bọc ApiClientService của core) -> trả về Promise như axios cũ.
 */
import { Injectable, inject } from '@angular/core';

import { CustomerHttpService } from '../customer-http.service';

@Injectable({ providedIn: 'root' })
export class ContactApiService {
  private readonly http = inject(CustomerHttpService);

  async submitContactMessage(data: any) {
    try {
      const response = await this.http.post('/contacts', data);
      return response.data;
    } catch (error: any) {
      console.error('Lỗi khi gửi thông điệp liên hệ:', error);
      throw error;
    }
  }
}

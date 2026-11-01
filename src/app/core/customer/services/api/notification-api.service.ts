/**
 * Chuyển từ React: src/services/notificationService.js
 *
 * - Các hàm "normalize..." / tiện ích không gọi API: giữ nguyên là hàm export (thuần, dùng được ở mọi nơi).
 * - Các hàm async gọi API: gom vào class NotificationApiService (inject vào component).
 *   Gọi HTTP qua CustomerHttpService (bọc ApiClientService của core) -> trả về Promise như axios cũ.
 */
import { Injectable, inject } from '@angular/core';

import { CustomerHttpService, assertSuccess } from '../customer-http.service';

@Injectable({ providedIn: 'root' })
export class NotificationApiService {
  private readonly http = inject(CustomerHttpService);

  async getNotifications(status?: any, search?: any) {
    try {
      const response = await this.http.get('/notifications', {
        params: { status, search }
      });
      const data = assertSuccess(response);
      return Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  async markAsRead(notificationId: any) {
    try {
      const response = await this.http.patch(`/notifications/${notificationId}/read`);
      return assertSuccess(response);
    } catch {
      return { success: true };
    }
  }

  async markAllAsRead() {
    try {
      const response = await this.http.patch('/notifications/read-all');
      return assertSuccess(response);
    } catch {
      return { success: true };
    }
  }
}

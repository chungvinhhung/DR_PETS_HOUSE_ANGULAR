/**
 * Chuyển từ React: src/services/notificationService.js
 *
 * - Các hàm "normalize..." / tiện ích không gọi API: giữ nguyên là hàm export (thuần, dùng được ở mọi nơi).
 * - Các hàm async gọi API: gom vào class NotificationApiService (inject vào component).
 *   Gọi HTTP qua CustomerHttpService (bọc ApiClientService của core) -> trả về Promise như axios cũ.
 */
import { Injectable, inject } from '@angular/core';

import { CustomerHttpService } from '../customer-http.service';

@Injectable({ providedIn: 'root' })
export class NotificationApiService {
  private readonly http = inject(CustomerHttpService);

  async getNotifications(status: any, search: any) {
    try {
      const response = await this.http.get('/notifications', {
        params: { status, search }
      });
      return response.data;
    } catch (error: any) {
      console.error('Lỗi khi tải thông báo:', error);
      throw error;
    }
  }

  async markAsRead(notificationId: any) {
    try {
      const response = await this.http.patch(`/notifications/${notificationId}/read`);
      return response.data;
    } catch (error: any) {
      console.error('Lỗi khi cập nhật trạng thái thông báo:', error);
      throw error;
    }
  }

  async markAllAsRead() {
    try {
      const response = await this.http.patch('/notifications/read-all');
      return response.data;
    } catch (error: any) {
      console.error('Lỗi khi đánh dấu tất cả thông báo đã đọc:', error);
      throw error;
    }
  }
}

import { effect, inject, Injectable, signal, untracked } from '@angular/core';

import { NotificationApiService } from './api/notification-api.service';
import { CustomerAuthService } from './customer-auth.service';

/**
 * Thông báo của khách hàng (thay cho context/NotificationContext.jsx).
 * Tự tải danh sách khi đăng nhập, xóa khi đăng xuất.
 */
@Injectable({ providedIn: 'root' })
export class CustomerNotificationService {
  private readonly auth = inject(CustomerAuthService);
  private readonly api = inject(NotificationApiService);

  readonly notifications = signal<any[]>([]);
  readonly unreadCount = signal(0);
  readonly isLoading = signal(false);

  constructor() {
    effect(() => {
      const authenticated = this.auth.isAuthenticated();
      untracked(() => {
        if (authenticated) void this.fetchNotifications();
        else {
          this.notifications.set([]);
          this.unreadCount.set(0);
        }
      });
    });
  }

  readonly fetchNotifications = async (status = 'all', search = ''): Promise<void> => {
    if (!this.auth.isAuthenticated()) return;
    this.isLoading.set(true);
    try {
      const response: any = await this.api.getNotifications(status, search);
      if (response && response.EC === 0) {
        const items = response.DT || [];
        this.notifications.set(items);
        if (status === 'all' && !search) this.unreadCount.set(items.filter((n: any) => !n.is_read).length);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  readonly markAsRead = async (notificationId: string | number): Promise<void> => {
    if (!this.auth.isAuthenticated()) return;
    try {
      const response: any = await this.api.markAsRead(notificationId);
      if (response && response.EC === 0) {
        this.notifications.update((prev) => prev.map((n) => (n.notification_id === String(notificationId) ? { ...n, is_read: true } : n)));
        this.unreadCount.update((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }

  readonly markAllAsRead = async (): Promise<void> => {
    if (!this.auth.isAuthenticated()) return;
    try {
      const response: any = await this.api.markAllAsRead();
      if (response && response.EC === 0) {
        this.notifications.update((prev) => prev.map((n) => ({ ...n, is_read: true })));
        this.unreadCount.set(0);
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }
}

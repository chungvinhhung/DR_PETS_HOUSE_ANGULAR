/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/components/Notifications/NotificationBell.jsx)
 */
import { navbarImages } from '../../../../shared/customer/assets/navbar-images';
import { notificationImages } from '../../../../shared/customer/assets/notification-images';
import { format, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

export function mapNotificationToUI(item: any) {
  let icon = null;
  if (item.notification_type === "appointment") {
    icon = notificationImages.iconCalendar;
  } else if (item.notification_type === "system") {
    icon = notificationImages.iconNote;
  }

  return {
    id: item.notification_id,
    type: item.notification_type,
    unread: !item.is_read,
    avatar: item.pet?.profile_image_url || null,
    avatarAlt: item.pet?.pet_name || "",
    avatarCrop: {}, // Có thể bỏ qua hoặc thêm logic crop nếu cần
    icon: icon,
    iconAlt: "Icon",
    relativeTime: item.created_at ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: vi }).toUpperCase() : "",
    dateTime: item.created_at ? format(new Date(item.created_at), "HH:mm dd/MM/yyyy", { locale: vi }) : "",
    searchableText: item.searchable_text || "",
    messageParts: item.message_parts ? (typeof item.message_parts === 'string' ? JSON.parse(item.message_parts) : item.message_parts) : [{ text: item.content || item.title }],
  };
}


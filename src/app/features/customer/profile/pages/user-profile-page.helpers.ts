/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/pages/User/UserProfilePage.jsx)
 */
import { DEFAULT_USER_ADDRESSES, DEFAULT_USER_PROFILE, PROFILE_STORAGE_KEYS } from '../../../../core/customer/constants/user-profile-data';

const defaultAvatar = '/assets/customer/images/profile/user-avatar.png';

export const inputClass =
  "input-brand h-12 w-full rounded-lg border-[#c1c6d5] px-3 text-base text-black";

export function loadStoredData(key: any, fallback: any) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

export function formatAddressLine(address: any) {
  const streetAddress = String(address.address ?? "").trim();
  const city = String(address.city ?? "").trim();

  if (!city || streetAddress.toLowerCase().includes(city.toLowerCase())) {
    return streetAddress;
  }

  return ([streetAddress, city].filter(Boolean) as any[]).join(", ");
}


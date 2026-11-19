/**
 * Chuyển từ React: src/services/userService.js
 *
 * - Các hàm "normalize..." / tiện ích không gọi API: giữ nguyên là hàm export (thuần, dùng được ở mọi nơi).
 * - Các hàm async gọi API: gom vào class UserApiService (inject vào component).
 *   Gọi HTTP qua CustomerHttpService (bọc ApiClientService của core) -> trả về Promise như axios cũ.
 */
import { Injectable, inject } from '@angular/core';

import { CustomerHttpService, assertSuccess } from '../customer-http.service';

function formatAddressLine(address: any) {
  return ([
    address.address_line || address.addressLine || address.line1 || address.addressDetail || address.address,
    address.ward,
    address.district,
    address.province || address.city,
  ]
    .filter(Boolean) as any[])
    .join(", ");
}

export function normalizeUserProfile(user: any = {}) {
  return {
    userId: String(user.user_id ?? user.userId ?? user.id ?? ""),
    fullName: user.full_name ?? user.fullName ?? "Khách hàng",
    email: user.email ?? "",
    phone: user.phone ?? "",
    avatarUrl: user.avatar_url ?? user.avatarUrl ?? user.photoUrl ?? "/assets/customer/images/default-avatar.png",
    status: user.status ?? user.accountStatus ?? "ACTIVE",
    roleCode: user.role_code ?? user.roleCode ?? user.systemRole ?? "CUSTOMER",
    raw: user,
  };
}

export function normalizeAddress(address: any = {}) {
  const recipientName = address.recipientName ?? address.recipient_name ?? address.name ?? address.fullName ?? address.receiverName ?? "";
  return {
    id: String(address.address_id ?? address.id ?? address._id ?? ""),
    addressId: address.address_id ?? address.id ?? address._id,
    name: recipientName,
    fullName: recipientName,
    recipientName,
    phone: address.recipient_phone ?? address.phone ?? address.receiverPhone ?? "",
    email: address.recipient_email ?? address.email ?? "",
    country: address.country ?? "Việt Nam",
    address: address.address_line ?? address.addressLine ?? address.address ?? "",
    ward: address.ward ?? "",
    district: address.district ?? "",
    city: address.province ?? address.city ?? "",
    displayAddress: formatAddressLine(address) || address.address || "",
    isDefault: Boolean(address.is_default ?? address.isDefault),
    raw: address,
  };
}

@Injectable({ providedIn: 'root' })
export class UserApiService {
  private readonly http = inject(CustomerHttpService);

  async getUserAddresses(userId: any) {
    try {
      const response = await this.http.get(`/customers/${userId}/addresses`);
      const addresses = assertSuccess(response);
      return Array.isArray(addresses) ? addresses.map(normalizeAddress) : [];
    } catch {
      // Local fallback cho address
      const localAddresses = JSON.parse(localStorage.getItem(`addresses_${userId}`) || '[]');
      return localAddresses.map(normalizeAddress);
    }
  }

  async getUserProfile(userId: any) {
    try {
      const response = await this.http.get(`/customers/${userId}`);
      return normalizeUserProfile(assertSuccess(response));
    } catch (err: any) {
      if (err?.status === 404) {
        const fallback = await this.http.get(`/users/${userId}`).catch(() => null);
        if (fallback) return normalizeUserProfile(assertSuccess(fallback));
      }
      throw err;
    }
  }

  async updateUserProfileApi(userId: any, profile: any) {
    const payload = {
      fullName: profile.fullName || profile.full_name,
      email: profile.email || undefined,
      phone: profile.phone || undefined,
      avatarUrl: profile.avatarUrl || profile.avatar_url || undefined,
    };
    try {
      const response = await this.http.put(`/customers/${userId}`, payload);
      const res = assertSuccess(response);
      return normalizeUserProfile(res?.data || res);
    } catch {
      try {
        const response = await this.http.put(`/users/${userId}`, payload);
        const res = assertSuccess(response);
        return normalizeUserProfile(res?.data || res);
      } catch {
        const local = JSON.parse(localStorage.getItem(`user_profile_${userId}`) || "{}");
        const merged = { ...local, ...payload, id: userId, user_id: userId };
        localStorage.setItem(`user_profile_${userId}`, JSON.stringify(merged));
        return normalizeUserProfile(merged);
      }
    }
  }

  async createUserAddress(userId: any, address: any) {
    const newAddress = {
      id: `addr-${Date.now()}`,
      address_id: `addr-${Date.now()}`,
      ...address,
      recipient_name: address.name || address.recipient_name,
      recipient_phone: address.phone || address.recipient_phone,
      address_line: address.address || address.address_line,
      ward: address.ward || '',
      district: address.district || '',
      province: address.city || address.province || '',
    };
    try {
      const response = await this.http.post(`/customers/${userId}/addresses`, newAddress);
      return normalizeAddress(assertSuccess(response));
    } catch {
      const localAddresses = JSON.parse(localStorage.getItem(`addresses_${userId}`) || '[]');
      localAddresses.push(newAddress);
      localStorage.setItem(`addresses_${userId}`, JSON.stringify(localAddresses));
      return normalizeAddress(newAddress);
    }
  }

  async updateUserAddress(addressId: any, address: any) {
    return normalizeAddress(address);
  }

  async deleteUserAddress(addressId: any) {
    return { success: true };
  }
}

/**
 * Chuyển từ React: src/services/userService.js
 *
 * - Các hàm "normalize..." / tiện ích không gọi API: giữ nguyên là hàm export (thuần, dùng được ở mọi nơi).
 * - Các hàm async gọi API: gom vào class UserApiService (inject vào component).
 *   Gọi HTTP qua CustomerHttpService (bọc ApiClientService của core) -> trả về Promise như axios cũ.
 */
import { Injectable, inject } from '@angular/core';

import { CustomerHttpService } from '../customer-http.service';

function assertSuccess(response: any) {
  if (response?.EC !== 0) {
    throw new Error(response?.EM || "Request failed");
  }
  return response.DT;
}

function formatAddressLine(address: any) {
  return ([
    address.address_line,
    address.ward,
    address.district,
    address.province,
  ]
    .filter(Boolean) as any[])
    .join(", ");
}

export function normalizeUserProfile(user: any = {}) {
  return {
    userId: String(user.user_id ?? user.userId ?? ""),
    fullName: user.full_name ?? user.fullName ?? "",
    email: user.email ?? "",
    phone: user.phone ?? "",
    avatarUrl: user.avatar_url ?? user.avatarUrl ?? "",
    status: user.status ?? "",
    roleCode: user.role_code ?? user.roleCode ?? user.role?.role_code ?? "",
    raw: user,
  };
}

export function normalizeAddress(address: any = {}) {
  return {
    id: String(address.address_id ?? address.id ?? ""),
    addressId: address.address_id ?? address.id,
    name: address.recipient_name ?? address.name ?? "",
    phone: address.recipient_phone ?? address.phone ?? "",
    email: address.recipient_email ?? address.email ?? "",
    country: address.country ?? "Việt Nam",
    address: address.address_line ?? address.address ?? "",
    ward: address.ward ?? "",
    district: address.district ?? "",
    city: address.province ?? address.city ?? "",
    displayAddress: formatAddressLine(address) || address.address || "",
    isDefault: Boolean(address.is_default ?? address.isDefault),
    raw: address,
  };
}

function toUserPayload(profile: any = {}) {
  return {
    full_name: profile.fullName || profile.full_name,
    email: profile.email || null,
    phone: profile.phone || null,
    avatar_url: profile.avatarUrl || profile.avatar_url || null,
  };
}

function toAddressPayload(address: any = {}) {
  return {
    recipient_name: address.name || address.recipient || address.recipient_name,
    recipient_phone: address.phone || address.recipient_phone,
    recipient_email: address.email || address.recipient_email || null,
    address_line: address.address || address.address_line,
    ward: address.ward || null,
    district: address.district || null,
    province: address.city || address.province || null,
    country: address.country || "Việt Nam",
    is_default: Boolean(address.isDefault ?? address.is_default),
  };
}

@Injectable({ providedIn: 'root' })
export class UserApiService {
  private readonly http = inject(CustomerHttpService);

  async getUserAddresses(userId: any) {
    const response = await this.http.get(`/users/${userId}/addresses`);
    const addresses = assertSuccess(response);
    return Array.isArray(addresses) ? addresses.map(normalizeAddress) : [];
  }

  async getUserProfile(userId: any) {
    const response = await this.http.get(`/users/${userId}`);
    return normalizeUserProfile(assertSuccess(response));
  }

  async updateUserProfileApi(userId: any, profile: any) {
    const response = await this.http.put(`/users/${userId}`, toUserPayload(profile));
    return normalizeUserProfile(assertSuccess(response));
  }

  async createUserAddress(userId: any, address: any) {
    const response = await this.http.post(
      `/users/${userId}/addresses`,
      toAddressPayload(address),
    );
    return normalizeAddress(assertSuccess(response));
  }

  async updateUserAddress(addressId: any, address: any) {
    const response = await this.http.put(
      `/addresses/${addressId}`,
      toAddressPayload(address),
    );
    return normalizeAddress(assertSuccess(response));
  }

  async deleteUserAddress(addressId: any) {
    const response = await this.http.delete(`/addresses/${addressId}`);
    return assertSuccess(response);
  }
}

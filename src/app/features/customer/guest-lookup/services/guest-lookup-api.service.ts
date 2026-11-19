/**
 * API tra cứu giao dịch Guest bằng SĐT/email + OTP (M02).
 *
 * Contract: BE docs/07-openapi-v6.yaml (tag Guest) + src/modules/customer/guest.routes.js
 *  - POST /guest/lookup/otp      { phone } | { email }        -> 202 { challengeId, expiresIn }
 *  - POST /guest/lookup/verify   { challengeId, otp }         -> 200 { lookupToken, expiresIn }
 *  - GET  /guest/transactions    header X-Guest-Lookup-Token  -> 200 { orders, appointments }
 *
 * Mọi request bật suppressAuthPrompt: lỗi 401 ở đây là lỗi OTP/lookup token của Guest,
 * không được đăng xuất hay bật popup đăng nhập Customer.
 */
import { Injectable, inject } from '@angular/core';

import { CustomerHttpService, assertSuccess } from '../../../../core/customer/services/customer-http.service';
import type {
  GuestLookupToken,
  GuestOtpChallenge,
  GuestOtpRequest,
  GuestTransactionList,
} from '../models/guest-lookup.models';

@Injectable({ providedIn: 'root' })
export class GuestLookupApiService {
  private readonly http = inject(CustomerHttpService);

  async requestOtp(contact: GuestOtpRequest): Promise<GuestOtpChallenge> {
    const response = await this.http.post('/guest/lookup/otp', contact, { suppressAuthPrompt: true });
    return assertSuccess<GuestOtpChallenge>(response);
  }

  async verifyOtp(challengeId: string, otp: string): Promise<GuestLookupToken> {
    const response = await this.http.post('/guest/lookup/verify', { challengeId, otp }, { suppressAuthPrompt: true });
    return assertSuccess<GuestLookupToken>(response);
  }

  async getTransactions(lookupToken: string): Promise<GuestTransactionList> {
    const response = await this.http.get('/guest/transactions', {
      headers: { 'X-Guest-Lookup-Token': lookupToken },
      suppressAuthPrompt: true,
    });
    const payload = assertSuccess<Partial<GuestTransactionList>>(response);
    return {
      orders: Array.isArray(payload?.orders) ? payload.orders : [],
      appointments: Array.isArray(payload?.appointments) ? payload.appointments : [],
    };
  }

  /** GET /branches (public) — Appointment chỉ có branchId nên tra tên chi nhánh để hiển thị. */
  async getBranchNames(): Promise<Record<string, string>> {
    const response = await this.http.get('/branches', { suppressAuthPrompt: true });
    const data = assertSuccess<any>(response);
    const items: any[] = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
    const names: Record<string, string> = {};
    for (const branch of items) {
      const id = String(branch?._id || branch?.id || '');
      const name = branch?.name || branch?.branchName;
      if (id && name) names[id] = name;
    }
    return names;
  }
}

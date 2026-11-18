import { inject, Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { ApiClientService } from '../../../../core/services/api-client.service';
import {
  AdminUser,
  AdminUsersResponse,
  CreateInternalUserRequest,
  UpdateUserRoleRequest,
  UpdateUserStatusRequest,
} from '../models/admin-user.model';

@Injectable({
  providedIn: 'root',
})
export class AdminUsersService {
  private readonly api = inject(ApiClientService);

  listUsers(page = 1, limit = 6): Observable<AdminUsersResponse> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));
    return this.api.get<AdminUsersResponse>('/admin/users', { params });
  }

  createInternalUser(
    request: CreateInternalUserRequest,
  ): Observable<AdminUser> {
    return this.api.post<AdminUser, CreateInternalUserRequest>(
      '/admin/users',
      request,
    );
  }

  /** MANAGER is a User.systemRole, never a StaffProfile.staffSubRole. */
  createManager(request: {
    fullName: string;
    phone?: string;
    email?: string;
    assignedBranchIds: string[];
  }): Observable<{ id: string; credentials?: { username: string; password: string } }> {
    return this.api.post<unknown, typeof request>('/managers', request).pipe(
      map(response => {
        const data = (response as { data?: { id?: string; credentials?: { username: string; password: string } } })?.data
          ?? response as { id?: string; credentials?: { username: string; password: string } };
        if (!data?.id) throw new Error('Chưa xác nhận được tài khoản quản lý vừa tạo. Vui lòng kiểm tra danh sách trước khi thử lại.');
        return { id: data.id, credentials: data.credentials };
      }),
    );
  }

  updateManager(id: string, request: {
    fullName: string;
    phone?: string;
    email?: string;
    assignedBranchIds: string[];
  }): Observable<unknown> {
    return this.api.patch('/managers/' + encodeURIComponent(id), request);
  }

  updateStatus(
    userId: string,
    request: UpdateUserStatusRequest,
  ): Observable<AdminUser> {
    return this.api.put<AdminUser, UpdateUserStatusRequest>(
      `/admin/users/${userId}/status`,
      request,
    );
  }

  updateRole(
    userId: string,
    request: UpdateUserRoleRequest,
  ): Observable<AdminUser> {
    return this.api.put<AdminUser, UpdateUserRoleRequest>(
      `/admin/users/${userId}/role`,
      request,
    );
  }
}

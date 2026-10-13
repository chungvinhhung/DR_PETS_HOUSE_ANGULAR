import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

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

  listUsers(): Observable<AdminUsersResponse> {
    return this.api.get<AdminUsersResponse>('/admin/users');
  }

  createInternalUser(
    request: CreateInternalUserRequest,
  ): Observable<AdminUser> {
    return this.api.post<AdminUser, CreateInternalUserRequest>(
      '/admin/users',
      request,
    );
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

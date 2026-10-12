export type SystemRole = 'ADMIN' | 'MANAGER' | 'STAFF' | 'CUSTOMER';

export type StaffSubRole = 'VETERINARIAN' | 'RECEPTIONIST' | string;

export interface AuthUser {
  id: string;
  phone: string;
  fullName: string;
  email: string | null;
  systemRole: SystemRole;
  staffSubRole: StaffSubRole | null;
  avatarUrl: string | null;
}

export interface LoginRequest {
  identifier: string;
  password: string;
  rememberMe: boolean;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

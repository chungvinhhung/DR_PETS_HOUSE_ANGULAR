export type SystemRole = 'ADMIN' | 'MANAGER' | 'STAFF' | 'CUSTOMER';

export type StaffSubRole =
  | 'RECEPTIONIST'
  | 'CARE_STAFF_GROOMER'
  | 'VETERINARIAN'
  | 'NURSE'
  | string;

export interface AuthUser {
  id: string;
  username?: string | null;
  phone: string;
  fullName: string;
  email: string | null;
  systemRole: SystemRole;
  staffSubRole: StaffSubRole | null;
  avatarUrl: string | null;
  accountStatus?: 'ACTIVE' | 'BLOCKED';
  activationStatus?: 'PENDING_ACTIVATION' | 'ACTIVATED' | 'NO_ACCOUNT';
  lastLogin?: string | null;
  branchScope?: readonly string[];
}

export interface CurrentUserResponse {
  id?: string;
  username?: string | null;
  _id?: string;
  phone: string;
  fullName: string;
  email?: string | null;
  systemRole: SystemRole;
  staffSubRole?: StaffSubRole | null;
  avatarUrl?: string | null;
  accountStatus?: 'ACTIVE' | 'BLOCKED';
  activationStatus?: 'PENDING_ACTIVATION' | 'ACTIVATED' | 'NO_ACCOUNT';
  lastLogin?: string | null;
  branchScope?: readonly string[];
}

export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface RefreshResponse {
  accessToken: string;
}

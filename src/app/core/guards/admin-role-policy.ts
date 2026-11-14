import { AuthUser } from '../models/auth.model';

/**
 * Fixed role matrix from WEB2 _ SHEET _ WORKSPACE (13).xlsx / feature (M01-M23).
 * No per-user grants. Backend MUST separately enforce ownership, branch and
 * assignment scopes; these flags only govern navigation and UI actions.
 */
export type AdminCapability =
  | 'profile.view' | 'dashboard.view'
  | 'products.view' | 'products.manage'
  | 'categories.view' | 'categories.manage'
  | 'orders.view' | 'orders.create' | 'orders.process'
  | 'returns.view' | 'returns.process' | 'returns.approve'
  | 'vouchers.view' | 'vouchers.manage'
  | 'flashsales.view' | 'flashsales.manage'
  | 'services.view' | 'services.manage' | 'services.configureBranch'
  | 'appointments.view' | 'appointments.create' | 'appointments.process'
  | 'records.view' | 'records.manage'
  | 'inventory.view' | 'inventory.manage'
  | 'branches.view' | 'branches.manage'
  | 'staff.view' | 'staff.manage'
  | 'shifts.view' | 'shifts.manage'
  | 'customers.view' | 'customers.manage'
  | 'content.view' | 'content.manage'
  | 'community.view' | 'community.moderate'
  | 'rescue.view' | 'rescue.manage'
  | 'moderation.view' | 'moderation.manage'
  | 'users.view' | 'users.manage';

const MANAGER_CAPABILITIES = new Set<AdminCapability>([
  'profile.view','dashboard.view',
  'products.view','categories.view',
  'orders.view','orders.create','orders.process',
  'returns.view','returns.process','returns.approve',
  'vouchers.view','flashsales.view',
  'services.view','services.configureBranch',
  'appointments.view','appointments.create','appointments.process',
  'records.view','records.manage',
  'inventory.view','inventory.manage','branches.view','branches.manage',
  'staff.view','staff.manage','shifts.view','shifts.manage',
  'customers.view',
  'content.view','content.manage','community.view','community.moderate',
  'rescue.view','rescue.manage','moderation.view','moderation.manage',
  'users.view',
]);

const STAFF_READ_CAPABILITIES = new Set<AdminCapability>([
  'profile.view','products.view','categories.view',
  'vouchers.view','flashsales.view','services.view',
  'appointments.view','shifts.view',
]);

const RECEPTIONIST_CAPABILITIES = new Set<AdminCapability>([
  'orders.view','orders.create','orders.process',
  'returns.view','returns.process',
  'appointments.create','appointments.process',
  'customers.view',
]);

const ASSIGNED_CARE_CAPABILITIES = new Set<AdminCapability>([
  'records.view','records.manage',
]);

export function canAdmin(
  user: Pick<AuthUser, 'systemRole' | 'staffSubRole'> | null | undefined,
  capability: AdminCapability,
): boolean {
  if (!user) return false;
  if (user.systemRole === 'ADMIN') return true;
  if (user.systemRole === 'MANAGER') return MANAGER_CAPABILITIES.has(capability);
  if (user.systemRole !== 'STAFF') return false;
  if (STAFF_READ_CAPABILITIES.has(capability)) return true;
  if (user.staffSubRole === 'RECEPTIONIST') {
    return RECEPTIONIST_CAPABILITIES.has(capability);
  }
  if (user.staffSubRole === 'CARE_STAFF_GROOMER' ||
      user.staffSubRole === 'VETERINARIAN' ||
      user.staffSubRole === 'NURSE') {
    return ASSIGNED_CARE_CAPABILITIES.has(capability);
  }
  // Fail closed for unrecognized staff roles.
  return false;
}

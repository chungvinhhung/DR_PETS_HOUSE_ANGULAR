/** Normalized view models backed by the live Staff/Shift APIs. */
export type JobRole = 'VETERINARIAN' | 'NURSE' | 'RECEPTIONIST' | 'CARE_STAFF' | 'MANAGER' | 'UNKNOWN';
export type StaffStatus = 'ACTIVE' | 'BLOCKED' | 'UNKNOWN';

export interface StaffPreview {
  id: string;
  userId?: string;
  /** Server ID; distinct from optional human-facing employee code. */
  staffCode?: string;
  branchIds?: readonly string[];
  homeBranchId?: string;
  fullName: string;
  jobRole: JobRole;
  branches: readonly string[];
  todayShift: string;
  accountStatus: StaffStatus;
  /** Optional fields are populated only where the Staff Detail Figma explicitly provides values. */
  homeBranch?: string;
  phone?: string;
  email?: string;
  loginUsername?: string;
}

export interface StaffShiftPreview {
  staffId: string;
  isoDate: string; // YYYY-MM-DD, branch-local business date
  branch: string;
  shiftName: string;
  time: string;
  shiftId?: string;
  branchId?: string;
}

export const JOB_LABELS: Record<JobRole, string> = {
  VETERINARIAN: 'Bác sĩ thú y',
  NURSE: 'Y tá',
  RECEPTIONIST: 'Lễ tân',
  CARE_STAFF: 'Nhân viên chăm sóc',
  MANAGER: 'Quản lý',
  UNKNOWN: '—',
};

export const JOB_PREFIX: Record<JobRole, string> = {
  VETERINARIAN: 'BS.',
  NURSE: 'YT.',
  RECEPTIONIST: 'LT.',
  CARE_STAFF: 'CS.',
  MANAGER: 'QL.',
  UNKNOWN: '',
};

export function displayStaffName(staff: StaffPreview): string {
  const prefix = JOB_PREFIX[staff.jobRole];
  return prefix ? `${prefix} ${staff.fullName}` : staff.fullName;
}

export function displayStaffShift(value: string): string {
  return value === '—' ? value : value.replace(/\s*[–—]\s*/g, ' - ');
}

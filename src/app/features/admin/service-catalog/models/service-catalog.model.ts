export type ServiceCategory = 'GROOMING' | 'MEDICAL' | string;
export type ServiceBookingMode = 'BOOKABLE' | 'REQUEST_ONLY' | 'CONTACT_ONLY';
export type ServiceMasterStatus = 'ACTIVE' | 'INACTIVE';
export type BranchAvailability = 'BY_SHIFT' | 'CONTACT';

export interface CatalogBranch {
  id: string;
  name: string;
}

export interface BranchServicePreview {
  branchId: string;
  capacity: number;
  enabled: boolean;
  availability: BranchAvailability;
}

export interface CatalogService {
  id: string;
  serviceCode: string;
  name: string;
  category: ServiceCategory;
  executorRole: string;
  bookingMode: ServiceBookingMode;
  durationMinutes: number | null;
  status: ServiceMasterStatus;
  referencePrice: number | null;
  minFixedTierPrice: number | null;
  branchServices: BranchServicePreview[];
  /** BE aggregate fields; do not derive branch scope from FE demo values. */
  enabledBranchCount?: number;
  totalBranchCount?: number;
  branchEnabled?: boolean;
  availabilityText?: string;
  isAvailable?: boolean;
}

export type CatalogFilterStatus = ServiceMasterStatus | 'ALL';
export type CatalogFilterMode = ServiceBookingMode | 'ALL';

export interface CatalogListQuery {
  search: string;
  branchId: string;
  mode: CatalogFilterMode;
  status: CatalogFilterStatus;
  page: number;
  pageSize: number;
}

export interface CatalogListResult {
  items: CatalogService[];
  total: number;
  page: number;
  pageSize: number;
}

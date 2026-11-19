export type CategoryStatus = 'ACTIVE' | 'INACTIVE';

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  status: CategoryStatus;
  /** Optional until BE Category DTO exposes persisted creation time. */
  createdAt?: string;
}

export interface CategoryPageResponse {
  items: AdminCategory[];
  nextCursor: string | null;
}

export interface SaveCategoryRequest {
  name: string;
  slug?: string;
  /** null moves an existing category to the root; omit on create when no parent is chosen. */
  parentId?: string | null;
  status: CategoryStatus;
}

export type CategoryStatus = 'ACTIVE' | 'INACTIVE';

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  status: CategoryStatus;
}

export interface CategoryPageResponse {
  items: AdminCategory[];
  nextCursor: string | null;
}

export interface SaveCategoryRequest {
  name: string;
  parentId: string | null;
  status: CategoryStatus;
}

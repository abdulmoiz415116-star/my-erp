export type RecordStatus = 'active' | 'inactive' | 'posted' | 'void' | 'draft' | 'cancelled';

export interface BaseEntity {
  id: string;
  tenantId: string;
  status: RecordStatus;
  isDeleted: boolean;
  createdAt: string; // ISO 8601 string
  updatedAt: string;
  createdBy: string; // User UID
  updatedBy: string; // User UID
}

export type CreateEntityInput<T extends BaseEntity> = Omit<
  T,
  'id' | 'createdAt' | 'updatedAt' | 'tenantId' | 'status' | 'isDeleted' | 'createdBy' | 'updatedBy'
> & {
  status?: RecordStatus;
};

export type SortDirection = 'asc' | 'desc';

export interface QueryFilter<T = unknown> {
  field: keyof T | string;
  operator: '<' | '<=' | '==' | '!=' | '>=' | '>' | 'array-contains' | 'in' | 'array-contains-any';
  value: unknown;
}

export interface PaginationParams {
  page: number;
  pageSize: number;
  searchQuery?: string;
  status?: RecordStatus | 'all';
  sortBy?: string;
  sortDirection?: SortDirection;
}

export interface PaginatedResult<T> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export type ActionState<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

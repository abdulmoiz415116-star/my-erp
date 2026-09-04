import { TenantMembership } from './tenant';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  phoneNumber?: string | null;
  defaultTenantId?: string;
  tenants: { [tenantId: string]: TenantMembership };
  createdAt: string;
  updatedAt: string;
}

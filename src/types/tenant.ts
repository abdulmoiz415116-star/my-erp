import { RecordStatus, BaseEntity } from './common';

export type TenantRole = 'super_admin' | 'admin' | 'manager' | 'staff' | 'owner' | 'accountant';

export interface TenantSettings {
  currency: string;
  currencySymbol: string;
  fiscalYearStartMonth: number; // 1-12
  timezone: string;
  dateFormat: string;
  taxNumber?: string;
  taxName?: string; // e.g. 'VAT', 'GST', 'Sales Tax'
  defaultTaxRate?: number; // e.g. 15.0
  invoicePrefix?: string; // e.g. 'INV-'
  invoiceNextNumber?: number; // e.g. 1001
  purchaseOrderPrefix?: string; // e.g. 'PO-'
  purchaseOrderNextNumber?: number; // e.g. 1001
  enableRealtimeSync: boolean;
  allowNegativeInventory: boolean;
  enableLowStockAlerts?: boolean;
  enableCustomerOverdueAlerts?: boolean;
  enableSupplierPayableAlerts?: boolean;
  enableSystemEventAlerts?: boolean;
  enableAutoInvoiceNumbering?: boolean;
}

export interface TenantAddress {
  street?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface Tenant {
  id: string;
  name: string;
  legalName?: string;
  code: string; // e.g. "CORP-01"
  status: RecordStatus;
  isDeleted: boolean;
  logoUrl?: string;
  email: string;
  phone?: string;
  address?: TenantAddress;
  settings: TenantSettings;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface TenantMembership {
  tenantId: string;
  tenantName: string;
  role: TenantRole;
  status: RecordStatus;
  joinedAt: string;
}

export interface TenantUser extends BaseEntity {
  email: string;
  displayName: string;
  photoURL?: string;
  phone?: string;
  role: TenantRole;
  permissions?: string[];
  invitedBy?: string;
  lastLoginAt?: string;
}

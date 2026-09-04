import { BaseEntity } from './common';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'STATUS_CHANGE'
  | 'SOFT_DELETE'
  | 'HARD_DELETE'
  | 'LOGIN'
  | 'SETTINGS_CHANGE'
  | 'TENANT_SWITCH'
  | 'POST'
  | 'CANCEL'
  | 'PAYMENT'
  | 'STOCK_ADJUSTMENT'
  | 'DISABLE'
  | 'ENABLE';

export interface AuditLogEntry extends BaseEntity {
  userId: string;
  userEmail: string;
  userName: string;
  action: AuditAction;
  module: string; // e.g., 'customers', 'products', 'settings', 'auth', 'accounting', 'sales', 'purchases'
  entityId?: string;
  recordId?: string;
  entityName?: string;
  description: string;
  previousValue?: Record<string, unknown> | string | number | null;
  newValue?: Record<string, unknown> | string | number | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string; // ISO 8601
}


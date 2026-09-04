import { TenantRole } from './tenant';

export type Permission =
  // User Governance
  | 'users:view'
  | 'users:create'
  | 'users:edit'
  | 'users:status'
  | 'users:delete'
  // Master Records
  | 'customers:view'
  | 'customers:create'
  | 'customers:edit'
  | 'customers:delete'
  | 'products:view'
  | 'products:create'
  | 'products:edit'
  | 'products:delete'
  | 'suppliers:view'
  | 'suppliers:create'
  | 'suppliers:edit'
  | 'suppliers:delete'
  // Operations & Financials
  | 'sales:view'
  | 'sales:create'
  | 'sales:edit'
  | 'sales:delete'
  | 'purchases:view'
  | 'purchases:create'
  | 'purchases:edit'
  | 'purchases:delete'
  | 'expenses:view'
  | 'expenses:create'
  | 'expenses:edit'
  | 'expenses:delete'
  | 'payments:view'
  | 'payments:create'
  | 'payments:edit'
  | 'accounts:view'
  | 'accounts:create'
  | 'accounts:edit'
  | 'accounting:view'
  | 'accounting:manage'
  // Reports & Analytics
  | 'reports:view'
  // POS Checkout
  | 'pos:access'
  // Governance
  | 'settings:view'
  | 'settings:edit'
  | 'audit:view';

export const ROLE_PERMISSIONS: Record<TenantRole, Permission[]> = {
  super_admin: [
    'users:view', 'users:create', 'users:edit', 'users:status', 'users:delete',
    'customers:view', 'customers:create', 'customers:edit', 'customers:delete',
    'products:view', 'products:create', 'products:edit', 'products:delete',
    'suppliers:view', 'suppliers:create', 'suppliers:edit', 'suppliers:delete',
    'sales:view', 'sales:create', 'sales:edit', 'sales:delete',
    'purchases:view', 'purchases:create', 'purchases:edit', 'purchases:delete',
    'expenses:view', 'expenses:create', 'expenses:edit', 'expenses:delete',
    'payments:view', 'payments:create', 'payments:edit',
    'accounts:view', 'accounts:create', 'accounts:edit',
    'accounting:view', 'accounting:manage',
    'reports:view',
    'pos:access',
    'settings:view', 'settings:edit',
    'audit:view',
  ],
  owner: [
    'users:view', 'users:create', 'users:edit', 'users:status', 'users:delete',
    'customers:view', 'customers:create', 'customers:edit', 'customers:delete',
    'products:view', 'products:create', 'products:edit', 'products:delete',
    'suppliers:view', 'suppliers:create', 'suppliers:edit', 'suppliers:delete',
    'sales:view', 'sales:create', 'sales:edit', 'sales:delete',
    'purchases:view', 'purchases:create', 'purchases:edit', 'purchases:delete',
    'expenses:view', 'expenses:create', 'expenses:edit', 'expenses:delete',
    'payments:view', 'payments:create', 'payments:edit',
    'accounts:view', 'accounts:create', 'accounts:edit',
    'accounting:view', 'accounting:manage',
    'reports:view',
    'pos:access',
    'settings:view', 'settings:edit',
    'audit:view',
  ],
  admin: [
    'users:view', 'users:create', 'users:edit', 'users:status',
    'customers:view', 'customers:create', 'customers:edit', 'customers:delete',
    'products:view', 'products:create', 'products:edit', 'products:delete',
    'suppliers:view', 'suppliers:create', 'suppliers:edit', 'suppliers:delete',
    'sales:view', 'sales:create', 'sales:edit', 'sales:delete',
    'purchases:view', 'purchases:create', 'purchases:edit', 'purchases:delete',
    'expenses:view', 'expenses:create', 'expenses:edit',
    'payments:view', 'payments:create', 'payments:edit',
    'accounts:view', 'accounts:create', 'accounts:edit',
    'accounting:view', 'accounting:manage',
    'reports:view',
    'pos:access',
    'settings:view', 'settings:edit',
    'audit:view',
  ],
  manager: [
    'users:view',
    'customers:view', 'customers:create', 'customers:edit',
    'products:view', 'products:create', 'products:edit',
    'suppliers:view', 'suppliers:create', 'suppliers:edit',
    'sales:view', 'sales:create', 'sales:edit',
    'purchases:view', 'purchases:create', 'purchases:edit',
    'expenses:view', 'expenses:create', 'expenses:edit',
    'payments:view',
    'accounts:view',
    'accounting:view',
    'reports:view',
    'pos:access',
    'audit:view',
  ],
  accountant: [
    'customers:view',
    'suppliers:view',
    'products:view',
    'sales:view', 'sales:create',
    'purchases:view', 'purchases:create',
    'expenses:view', 'expenses:create', 'expenses:edit',
    'payments:view', 'payments:create', 'payments:edit',
    'accounts:view', 'accounts:create', 'accounts:edit',
    'accounting:view', 'accounting:manage',
    'reports:view',
    'audit:view',
  ],
  staff: [
    'customers:view', 'customers:create',
    'products:view',
    'suppliers:view',
    'sales:view', 'sales:create',
    'purchases:view',
    'expenses:view',
    'pos:access',
  ],
};

export function getRolePermissions(role: TenantRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function hasPermissionForRole(role: TenantRole, permission: Permission): boolean {
  const permissions = getRolePermissions(role);
  return permissions.includes(permission);
}

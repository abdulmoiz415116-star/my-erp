'use client';

import { useMemo } from 'react';
import { useTenant } from '@/context/TenantContext';
import { Permission, hasPermissionForRole, getRolePermissions } from '@/types/permissions';
import { TenantRole } from '@/types/tenant';

export function usePermissions() {
  const { userRole } = useTenant();

  const permissions = useMemo(() => {
    return getRolePermissions(userRole);
  }, [userRole]);

  const can = (permission: Permission): boolean => {
    return hasPermissionForRole(userRole, permission);
  };

  const hasAnyRole = (roles: TenantRole[]): boolean => {
    return roles.includes(userRole);
  };

  const isSuperAdmin = userRole === 'super_admin' || userRole === 'owner';
  const isAdmin = isSuperAdmin || userRole === 'admin';
  const isManager = isAdmin || userRole === 'manager';

  return {
    userRole,
    permissions,
    can,
    hasAnyRole,
    isSuperAdmin,
    isAdmin,
    isManager,
  };
}

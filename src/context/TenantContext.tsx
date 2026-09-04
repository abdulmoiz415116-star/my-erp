'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Tenant, TenantRole, TenantUser } from '@/types/tenant';
import { TenantService } from '@/services/tenant.service';
import { localReactiveStore } from '@/services/base.service';
import { getFirebaseFirestore } from '@/lib/firebase/client';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

interface TenantContextType {
  currentTenant: Tenant | null;
  tenants: Tenant[];
  loading: boolean;
  userRole: TenantRole;
  switchTenant: (tenantId: string) => Promise<void>;
  createTenant: (data: { name: string; code: string; email: string; currency?: string; phone?: string }) => Promise<Tenant>;
  refreshTenants: () => Promise<void>;
  updateCurrentTenant: (updated: Tenant) => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const STORAGE_ACTIVE_TENANT_KEY = 'erp_active_tenant_id';

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [userRole, setUserRole] = useState<TenantRole>('super_admin');
  const [loading, setLoading] = useState<boolean>(true);

  const fetchTenants = useCallback(async () => {
    try {
      const allTenants = await TenantService.getAllTenants();
      setTenants(allTenants);

      if (allTenants.length > 0) {
        const savedTenantId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_ACTIVE_TENANT_KEY) : null;
        const matched = allTenants.find((t) => t.id === savedTenantId);
        const selected = matched || allTenants[0];
        setCurrentTenant(selected);
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_ACTIVE_TENANT_KEY, selected.id);
        }
      } else {
        setCurrentTenant(null);
      }
    } catch (err) {
      console.error('Failed to load tenants:', err);
      showToast('Could not load enterprise workspaces', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants, user]);

  // Dynamically resolve user role based on tenant membership
  useEffect(() => {
    async function resolveRole() {
      if (!currentTenant || !user) {
        setUserRole('super_admin');
        return;
      }

      if (isFirebaseConfigured()) {
        const db = getFirebaseFirestore();
        if (db) {
          try {
            const memberDoc = await getDoc(doc(db, `tenants/${currentTenant.id}/users`, user.uid));
            if (memberDoc.exists()) {
              const data = memberDoc.data() as TenantUser;
              setUserRole(data.role === 'owner' ? 'super_admin' : data.role);
              return;
            }
          } catch (e) {
            console.warn('Error reading tenant role:', e);
          }
        }
      }

      // Local / Dev Fallback: match by UID or email
      const users = localReactiveStore.getItems<TenantUser>(currentTenant.id, 'users');
      const member = users.find((u) => u.id === user.uid || u.email.toLowerCase() === user.email.toLowerCase());
      if (member) {
        setUserRole(member.role === 'owner' ? 'super_admin' : member.role);
      } else {
        setUserRole('super_admin');
      }
    }

    resolveRole();
  }, [currentTenant, user]);

  const switchTenant = async (tenantId: string) => {
    setLoading(true);
    try {
      const found = tenants.find((t) => t.id === tenantId);
      if (found) {
        setCurrentTenant(found);
        localStorage.setItem(STORAGE_ACTIVE_TENANT_KEY, tenantId);
        showToast(`Switched workspace to ${found.name}`, 'info');
      } else {
        const fetched = await TenantService.getTenantById(tenantId);
        if (fetched) {
          setCurrentTenant(fetched);
          localStorage.setItem(STORAGE_ACTIVE_TENANT_KEY, tenantId);
          showToast(`Switched workspace to ${fetched.name}`, 'info');
        }
      }
    } catch (error) {
      console.error('Error switching tenant:', error);
      showToast('Error switching tenant workspace', 'error');
    } finally {
      setLoading(false);
    }
  };

  const createTenant = async (data: {
    name: string;
    code: string;
    email: string;
    currency?: string;
    phone?: string;
  }): Promise<Tenant> => {
    setLoading(true);
    try {
      const newTenant = await TenantService.createTenant(data, user?.uid || 'admin');
      await fetchTenants();
      setCurrentTenant(newTenant);
      localStorage.setItem(STORAGE_ACTIVE_TENANT_KEY, newTenant.id);
      showToast(`Workspace "${newTenant.name}" created successfully!`, 'success');
      return newTenant;
    } catch (error) {
      console.error('Failed to create tenant:', error);
      showToast('Failed to create workspace', 'error');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const refreshTenants = async () => {
    await fetchTenants();
  };

  const updateCurrentTenant = (updated: Tenant) => {
    setCurrentTenant(updated);
    setTenants((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  return (
    <TenantContext.Provider
      value={{
        currentTenant,
        tenants,
        loading,
        userRole,
        switchTenant,
        createTenant,
        refreshTenants,
        updateCurrentTenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantContextType {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}

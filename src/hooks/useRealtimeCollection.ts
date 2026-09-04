'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { BaseEntity, RecordStatus, CreateEntityInput } from '@/types/common';
import { BaseFirestoreService } from '@/services/base.service';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { compareValues } from '@/lib/utils';

interface UseRealtimeCollectionOptions {
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  autoSync?: boolean;
}

export function useRealtimeCollection<T extends BaseEntity>(
  serviceFactory: (tenantId: string) => BaseFirestoreService<T>,
  options: UseRealtimeCollectionOptions = {}
) {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [rawItems, setRawItems] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & pagination state
  const [statusFilter, setStatusFilter] = useState<RecordStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [sortBy, setSortBy] = useState<string>(options.sortBy || 'createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(options.sortDirection || 'desc');

  const tenantId = currentTenant?.id || '';

  const serviceFactoryRef = useRef(serviceFactory);
  serviceFactoryRef.current = serviceFactory;

  const service = useMemo(() => {
    if (!tenantId) return null;
    return serviceFactoryRef.current(tenantId);
  }, [tenantId]);

  // Real-time listener setup
  useEffect(() => {
    if (!service || !tenantId) {
      setRawItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = service.subscribe((items) => {
      setRawItems(items);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [service, tenantId]);

  // Process filtering, search, sorting & pagination on real-time collection
  const filteredItems = useMemo(() => {
    let result = [...rawItems];

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((item) => item.status === statusFilter);
    }

    // Search query across all properties
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((item) => {
        return Object.entries(item).some(([key, val]) => {
          if (key === 'id' || key === 'tenantId' || key === 'createdBy' || key === 'updatedBy') return false;
          if (typeof val === 'string') return val.toLowerCase().includes(q);
          if (typeof val === 'number') return val.toString().includes(q);
          if (typeof val === 'object' && val !== null) {
            return JSON.stringify(val).toLowerCase().includes(q);
          }
          return false;
        });
      });
    }

    // Dynamic Sort
    result.sort((a, b) => {
      const valA = (a as unknown as Record<string, unknown>)[sortBy];
      const valB = (b as unknown as Record<string, unknown>)[sortBy];
      return compareValues(valA, valB, sortDirection);
    });

    return result;
  }, [rawItems, statusFilter, searchQuery, sortBy, sortDirection]);

  // Paginated view
  const totalCount = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredItems.slice(startIndex, startIndex + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  // Actions
  const createItem = useCallback(
    async (data: CreateEntityInput<T>) => {
      if (!service) throw new Error('No active workspace selected');
      try {
        const created = await service.create(data, user?.uid || 'user');
        showToast('Record created successfully', 'success');
        return created;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Creation failed';
        showToast(msg, 'error');
        throw err;
      }
    },
    [service, user, showToast]
  );

  const updateItem = useCallback(
    async (id: string, updates: Partial<T>) => {
      if (!service) throw new Error('No active workspace selected');
      try {
        const updated = await service.update(id, updates, user?.uid || 'user');
        showToast('Record updated successfully', 'success');
        return updated;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Update failed';
        showToast(msg, 'error');
        throw err;
      }
    },
    [service, user, showToast]
  );

  const toggleStatus = useCallback(
    async (id: string, newStatus: RecordStatus) => {
      if (!service) throw new Error('No active workspace selected');
      try {
        const updated = await service.toggleStatus(id, newStatus, user?.uid || 'user');
        showToast(`Record status changed to ${newStatus}`, 'info');
        return updated;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Status change failed';
        showToast(msg, 'error');
        throw err;
      }
    },
    [service, user, showToast]
  );

  const softDeleteItem = useCallback(
    async (id: string) => {
      if (!service) throw new Error('No active workspace selected');
      try {
        await service.softDelete(id, user?.uid || 'user');
        showToast('Record deactivated and removed from active view', 'info');
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Deletion failed';
        showToast(msg, 'error');
        throw err;
      }
    },
    [service, user, showToast]
  );

  const hardDeleteItem = useCallback(
    async (id: string) => {
      if (!service) throw new Error('No active workspace selected');
      try {
        await service.hardDelete(id, user?.uid || 'user');
        showToast('Record permanently purged', 'warning');
        return true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Permanent deletion failed';
        showToast(msg, 'error');
        throw err;
      }
    },
    [service, user, showToast]
  );

  return {
    items: paginatedItems,
    allItems: filteredItems,
    totalCount,
    loading,
    error,
    page: currentPage,
    pageSize,
    totalPages,
    setPage,
    setPageSize,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    sortBy,
    sortDirection,
    setSortBy,
    setSortDirection,
    createItem,
    updateItem,
    toggleStatus,
    softDeleteItem,
    hardDeleteItem,
  };
}

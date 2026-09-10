import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Unsubscribe,
  DocumentData,
  QueryConstraint,
} from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase/client';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { BaseEntity, PaginationParams, PaginatedResult, RecordStatus, QueryFilter, CreateEntityInput } from '@/types/common';
import { generateUUID, compareValues } from '@/lib/utils';
import { AuditLogEntry, AuditAction } from '@/types/audit';
import { 
  INITIAL_CUSTOMERS, 
  INITIAL_PRODUCTS, 
  INITIAL_AUDIT_LOGS, 
  INITIAL_USERS, 
  INITIAL_TENANTS,
  INITIAL_SUPPLIERS,
  INITIAL_ACCOUNTS,
  INITIAL_SALES,
  INITIAL_PURCHASES,
  INITIAL_EXPENSES,
  INITIAL_PAYMENTS,
  INITIAL_CATEGORIES,
  INITIAL_STOCK_TRANSACTIONS,
  INITIAL_JOURNAL_ENTRIES,
} from '@/lib/mockData';

// In-memory fallback repository with cross-tab localStorage synchronization & auto-seeding
class LocalReactiveStore {
  private listeners: Map<string, Set<(data: { id: string }[]) => void>> = new Map();
  private isInitialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initStore();
      window.addEventListener('storage', (e) => {
        if (!e.key || !e.key.startsWith('erp_tenant_')) return;
        const parts = e.key.split('_');
        if (parts.length >= 4) {
          const tenantId = parts[2];
          const moduleName = parts.slice(3).join('_');
          try {
            const items = JSON.parse(e.newValue || '[]');
            this.notify(tenantId, moduleName, items);
          } catch {
            // ignore
          }
        }
      });
    }
  }

  private initStore() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;
    const CURRENT_VERSION = 'v12_omega_lights_enterprise_live_synced';
    const currentVer = localStorage.getItem('erp_schema_version');
    if (currentVer !== CURRENT_VERSION) {
      localStorage.setItem('erp_schema_version', CURRENT_VERSION);
      // Auto seed required collections for active enterprise tenants
      ['tenant-apex-corp', 'tenant-nexus-tech'].forEach((tId) => {
        ['categories', 'stock_transactions', 'products', 'customers', 'suppliers', 'sales', 'purchases', 'expenses', 'payments', 'accounts', 'journal_entries', 'audit_logs', 'users'].forEach((mod) => {
          const seed = this.getInitialSeed<{ id: string }>(tId, mod);
          const key = this.getStorageKey(tId, mod);
          localStorage.setItem(key, JSON.stringify(seed));
        });
      });
      localStorage.setItem(this.getStorageKey('global', 'tenants'), JSON.stringify(INITIAL_TENANTS));
    }
  }

  private getStorageKey(tenantId: string, moduleName: string) {
    return `erp_tenant_${tenantId}_${moduleName}`;
  }

  getItems<T extends { id: string }>(tenantId: string, moduleName: string): T[] {
    if (typeof window === 'undefined') {
      return this.getInitialSeed<T>(tenantId, moduleName);
    }
    this.initStore();
    const key = this.getStorageKey(tenantId, moduleName);
    const stored = localStorage.getItem(key);
    if (!stored || stored === '[]') {
      const seed = this.getInitialSeed<T>(tenantId, moduleName);
      if (seed.length > 0) {
        localStorage.setItem(key, JSON.stringify(seed));
        return seed;
      }
      return [];
    }
    try {
      return JSON.parse(stored) as T[];
    } catch {
      return this.getInitialSeed<T>(tenantId, moduleName);
    }
  }

  saveItems<T extends { id: string }>(tenantId: string, moduleName: string, items: T[]) {
    if (typeof window === 'undefined') return;
    const key = this.getStorageKey(tenantId, moduleName);
    localStorage.setItem(key, JSON.stringify(items));
    this.notify(tenantId, moduleName, items);
  }

  resetTenantData(tenantId: string) {
    if (typeof window === 'undefined') return;
    const modules = [
      'customers',
      'suppliers',
      'products',
      'categories',
      'stock_transactions',
      'sales',
      'purchases',
      'expenses',
      'payments',
      'accounts',
      'journal_entries',
      'audit_logs',
      'users',
    ];
    modules.forEach((mod) => {
      const seed = this.getInitialSeed<{ id: string }>(tenantId, mod);
      this.saveItems(tenantId, mod, seed);
    });
  }

  subscribe<T extends { id: string }>(tenantId: string, moduleName: string, callback: (items: T[]) => void): () => void {
    const key = `${tenantId}_${moduleName}`;
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    const set = this.listeners.get(key)!;
    set.add(callback as unknown as (data: { id: string }[]) => void);

    // Initial trigger
    callback(this.getItems<T>(tenantId, moduleName));

    return () => {
      set.delete(callback as unknown as (data: { id: string }[]) => void);
    };
  }

  private notify<T extends { id: string }>(tenantId: string, moduleName: string, items: T[]) {
    const key = `${tenantId}_${moduleName}`;
    const set = this.listeners.get(key);
    if (set) {
      set.forEach((cb) => cb(items));
    }
  }

  private getInitialSeed<T>(tenantId: string, moduleName: string): T[] {
    if (moduleName === 'customers') {
      return (INITIAL_CUSTOMERS.filter((c) => c.tenantId === tenantId) as unknown[]) as T[];
    }
    if (moduleName === 'suppliers') {
      return (INITIAL_SUPPLIERS.filter((s) => s.tenantId === tenantId) as unknown[]) as T[];
    }
    if (moduleName === 'products') {
      return (INITIAL_PRODUCTS.filter((p) => p.tenantId === tenantId) as unknown[]) as T[];
    }
    if (moduleName === 'sales') {
      return (INITIAL_SALES.filter((s) => s.tenantId === tenantId) as unknown[]) as T[];
    }
    if (moduleName === 'purchases') {
      return (INITIAL_PURCHASES.filter((p) => p.tenantId === tenantId) as unknown[]) as T[];
    }
    if (moduleName === 'expenses') {
      return (INITIAL_EXPENSES.filter((e) => e.tenantId === tenantId) as unknown[]) as T[];
    }
    if (moduleName === 'payments') {
      return (INITIAL_PAYMENTS.filter((p) => p.tenantId === tenantId) as unknown[]) as T[];
    }
    if (moduleName === 'accounts') {
      const match = INITIAL_ACCOUNTS.filter((a) => a.tenantId === tenantId);
      if (match.length > 0) return (match as unknown[]) as T[];
      return (INITIAL_ACCOUNTS.map((a) => ({ ...a, id: `${tenantId}-${a.id}`, tenantId })) as unknown[]) as T[];
    }
    if (moduleName === 'journal_entries') {
      const match = INITIAL_JOURNAL_ENTRIES.filter((j) => j.tenantId === tenantId);
      if (match.length > 0) return (match as unknown[]) as T[];
      return (INITIAL_JOURNAL_ENTRIES.map((j) => ({ ...j, id: `${tenantId}-${j.id}`, tenantId })) as unknown[]) as T[];
    }
    if (moduleName === 'audit_logs') {
      return (INITIAL_AUDIT_LOGS.filter((a) => a.tenantId === tenantId) as unknown[]) as T[];
    }
    if (moduleName === 'categories') {
      return (INITIAL_CATEGORIES.filter((c) => c.tenantId === tenantId) as unknown[]) as T[];
    }
    if (moduleName === 'stock_transactions') {
      return (INITIAL_STOCK_TRANSACTIONS.filter((s) => s.tenantId === tenantId) as unknown[]) as T[];
    }
    if (moduleName === 'users') {
      return (INITIAL_USERS.filter((u) => u.tenantId === tenantId) as unknown[]) as T[];
    }
    if (moduleName === 'tenants') {
      return (INITIAL_TENANTS as unknown[]) as T[];
    }
    return [];
  }
}

// Singleton preserved across Next.js Fast Refresh cycles
const globalStore = globalThis as unknown as { __localReactiveStore?: LocalReactiveStore };
export const localReactiveStore = globalStore.__localReactiveStore || new LocalReactiveStore();
if (process.env.NODE_ENV !== 'production') {
  globalStore.__localReactiveStore = localReactiveStore;
}

export class BaseFirestoreService<T extends BaseEntity> {
  protected collectionName: string;
  protected tenantId: string;

  constructor(collectionName: string, tenantId: string) {
    this.collectionName = collectionName;
    this.tenantId = tenantId;
  }

  protected getCollectionPath(): string {
    return `tenants/${this.tenantId}/${this.collectionName}`;
  }

  async create(
    data: CreateEntityInput<T>,
    userId: string = 'system'
  ): Promise<T> {
    const id = generateUUID();
    const now = new Date().toISOString();

    const entity: T = {
      ...data,
      id,
      tenantId: this.tenantId,
      status: data.status || 'active',
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
      createdBy: userId,
      updatedBy: userId,
    } as unknown as T;

    if (isFirebaseConfigured()) {
      const db = getFirebaseFirestore();
      if (db) {
        const docRef = doc(db, this.getCollectionPath(), id);
        await setDoc(docRef, entity as DocumentData);
        await this.logAudit('CREATE', id, (data as unknown as { name?: string }).name || id, 'Created record', userId);
        return entity;
      }
    }

    // Local / Dev Fallback
    const existing = localReactiveStore.getItems<T>(this.tenantId, this.collectionName);
    localReactiveStore.saveItems<T>(this.tenantId, this.collectionName, [entity, ...existing]);
    await this.logAudit('CREATE', id, (data as unknown as { name?: string }).name || id, 'Created record', userId);
    return entity;
  }

  async update(id: string, updates: Partial<T>, userId: string = 'system'): Promise<T> {
    const now = new Date().toISOString();
    const cleanUpdates = {
      ...updates,
      updatedAt: now,
      updatedBy: userId,
    };

    if (isFirebaseConfigured()) {
      const db = getFirebaseFirestore();
      if (db) {
        const docRef = doc(db, this.getCollectionPath(), id);
        await updateDoc(docRef, cleanUpdates as DocumentData);
        const updatedDoc = await getDoc(docRef);
        await this.logAudit('UPDATE', id, (updates as unknown as { name?: string }).name || id, 'Updated record', userId);
        return updatedDoc.data() as T;
      }
    }

    // Local / Dev Fallback
    const items = localReactiveStore.getItems<T>(this.tenantId, this.collectionName);
    let updatedRecord: T | null = null;
    const newItems = items.map((item) => {
      if (item.id === id) {
        updatedRecord = { ...item, ...cleanUpdates } as T;
        return updatedRecord;
      }
      return item;
    });

    if (!updatedRecord) {
      throw new Error(`Record with ID ${id} not found.`);
    }

    localReactiveStore.saveItems<T>(this.tenantId, this.collectionName, newItems);
    await this.logAudit('UPDATE', id, (updatedRecord as unknown as { name?: string }).name || id, 'Updated record', userId);
    return updatedRecord;
  }

  async toggleStatus(id: string, newStatus: RecordStatus, userId: string = 'system'): Promise<T> {
    const updated = await this.update(id, { status: newStatus } as unknown as Partial<T>, userId);
    await this.logAudit(
      'STATUS_CHANGE',
      id,
      (updated as unknown as { name?: string }).name || id,
      `Changed status to ${newStatus}`,
      userId
    );
    return updated;
  }

  async softDelete(id: string, userId: string = 'system'): Promise<boolean> {
    await this.update(
      id,
      {
        isDeleted: true,
        status: 'inactive',
      } as unknown as Partial<T>,
      userId
    );
    await this.logAudit('SOFT_DELETE', id, id, 'Deactivated & soft-deleted record', userId);
    return true;
  }

  async hardDelete(id: string, userId: string = 'system'): Promise<boolean> {
    if (isFirebaseConfigured()) {
      const db = getFirebaseFirestore();
      if (db) {
        const docRef = doc(db, this.getCollectionPath(), id);
        await deleteDoc(docRef);
        await this.logAudit('HARD_DELETE', id, id, 'Permanently purged record', userId);
        return true;
      }
    }

    const items = localReactiveStore.getItems<T>(this.tenantId, this.collectionName);
    const remaining = items.filter((item) => item.id !== id);
    localReactiveStore.saveItems<T>(this.tenantId, this.collectionName, remaining);
    await this.logAudit('HARD_DELETE', id, id, 'Permanently purged record', userId);
    return true;
  }

  async getById(id: string): Promise<T | null> {
    if (isFirebaseConfigured()) {
      const db = getFirebaseFirestore();
      if (db) {
        const docRef = doc(db, this.getCollectionPath(), id);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          return snapshot.data() as T;
        }
        return null;
      }
    }

    const items = localReactiveStore.getItems<T>(this.tenantId, this.collectionName);
    return items.find((item) => item.id === id) || null;
  }

  async list(params: PaginationParams = { page: 1, pageSize: 10 }): Promise<PaginatedResult<T>> {
    const { page = 1, pageSize = 10, searchQuery, status, sortBy = 'createdAt', sortDirection = 'desc' } = params;

    let items: T[] = [];

    if (isFirebaseConfigured()) {
      const db = getFirebaseFirestore();
      if (db) {
        const constraints: QueryConstraint[] = [where('isDeleted', '==', false)];
        if (status && status !== 'all') {
          constraints.push(where('status', '==', status));
        }
        constraints.push(orderBy(sortBy, sortDirection));

        const q = query(collection(db, this.getCollectionPath()), ...constraints);
        const querySnapshot = await getDocs(q);
        items = querySnapshot.docs.map((docSnap) => docSnap.data() as T);
      }
    } else {
      items = localReactiveStore
        .getItems<T>(this.tenantId, this.collectionName)
        .filter((item) => !item.isDeleted);
    }

    // Filter by status if not already handled
    if (status && status !== 'all') {
      items = items.filter((item) => item.status === status);
    }

    // Universal client search across text fields
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter((item) => {
        return Object.values(item).some((val) => {
          if (typeof val === 'string') return val.toLowerCase().includes(q);
          if (typeof val === 'number') return val.toString().includes(q);
          return false;
        });
      });
    }

    // Sort
    items.sort((a, b) => {
      const valA = (a as unknown as Record<string, unknown>)[sortBy];
      const valB = (b as unknown as Record<string, unknown>)[sortBy];
      return compareValues(valA, valB, sortDirection);
    });

    const totalCount = items.length;
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    const startIndex = (page - 1) * pageSize;
    const paginatedItems = items.slice(startIndex, startIndex + pageSize);

    return {
      data: paginatedItems,
      totalCount,
      page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  // Real-time collection subscription
  subscribe(
    callback: (items: T[]) => void,
    filters?: QueryFilter<T>[],
    sortBy: string = 'createdAt',
    sortDir: 'asc' | 'desc' = 'desc'
  ): Unsubscribe {
    if (isFirebaseConfigured()) {
      const db = getFirebaseFirestore();
      if (db) {
        const constraints: QueryConstraint[] = [where('isDeleted', '==', false)];
        if (filters) {
          filters.forEach((f) => {
            constraints.push(where(f.field as string, f.operator, f.value));
          });
        }
        constraints.push(orderBy(sortBy, sortDir));
        const q = query(collection(db, this.getCollectionPath()), ...constraints);

        return onSnapshot(
          q,
          (snapshot) => {
            const data = snapshot.docs.map((docSnap) => docSnap.data() as T);
            callback(data);
          },
          (error) => {
            console.error(`Firestore real-time subscription error on ${this.getCollectionPath()}:`, error);
          }
        );
      }
    }

    // Local / Dev Fallback subscription
    return localReactiveStore.subscribe<T>(this.tenantId, this.collectionName, (allItems) => {
      let filtered = allItems.filter((item) => !item.isDeleted);
      if (filters) {
        filters.forEach((f) => {
          filtered = filtered.filter((item) => {
            const itemVal = (item as unknown as Record<string, unknown>)[f.field as string];
            if (f.operator === '==') return itemVal === f.value;
            if (f.operator === '!=') return itemVal !== f.value;
            return true;
          });
        });
      }
      filtered.sort((a, b) => {
        const valA = (a as unknown as Record<string, unknown>)[sortBy];
        const valB = (b as unknown as Record<string, unknown>)[sortBy];
        return compareValues(valA, valB, sortDir);
      });
      callback(filtered);
    });
  }

  private async logAudit(action: AuditAction, entityId: string, entityName: string, desc: string, userId: string) {
    try {
      const now = new Date().toISOString();
      const auditEntry: AuditLogEntry = {
        id: generateUUID(),
        tenantId: this.tenantId,
        userId,
        userEmail: 'user@erp.local',
        userName: 'Current User',
        action,
        module: this.collectionName,
        entityId,
        entityName,
        description: desc,
        timestamp: now,
        status: 'active',
        isDeleted: false,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        updatedBy: userId,
      };

      if (isFirebaseConfigured()) {
        const db = getFirebaseFirestore();
        if (db) {
          await setDoc(doc(db, `tenants/${this.tenantId}/audit_logs`, auditEntry.id), auditEntry);
          return;
        }
      }

      const logs = localReactiveStore.getItems(this.tenantId, 'audit_logs');
      localReactiveStore.saveItems(this.tenantId, 'audit_logs', [auditEntry, ...logs]);
    } catch (e) {
      console.warn('Audit log write error:', e);
    }
  }
}

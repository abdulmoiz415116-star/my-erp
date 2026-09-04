import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { getFirebaseFirestore } from '@/lib/firebase/client';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { Tenant, TenantSettings, TenantAddress } from '@/types/tenant';
import { localReactiveStore } from './base.service';
import { INITIAL_TENANTS } from '@/lib/mockData';
import { generateUUID } from '@/lib/utils';

export class TenantService {
  static async getAllTenants(): Promise<Tenant[]> {
    if (isFirebaseConfigured()) {
      // In production, user's tenant memberships are read from their user profile or claims
    }
    const tenants = localReactiveStore.getItems<Tenant>('global', 'tenants');
    if (!tenants || tenants.length === 0) {
      localReactiveStore.saveItems('global', 'tenants', INITIAL_TENANTS);
      return INITIAL_TENANTS;
    }
    return tenants.filter((t) => !t.isDeleted);
  }

  static async getTenantById(tenantId: string): Promise<Tenant | null> {
    if (isFirebaseConfigured()) {
      const db = getFirebaseFirestore();
      if (db) {
        const snap = await getDoc(doc(db, 'tenants', tenantId));
        if (snap.exists()) return snap.data() as Tenant;
      }
    }
    const tenants = await this.getAllTenants();
    return tenants.find((t) => t.id === tenantId) || null;
  }

  static async createTenant(
    data: {
      name: string;
      code: string;
      email: string;
      legalName?: string;
      phone?: string;
      currency?: string;
      timezone?: string;
    },
    ownerId: string
  ): Promise<Tenant> {
    const tenantId = `tenant-${data.code.toLowerCase().replace(/[^a-z0-9]/g, '')}-${generateUUID().slice(0, 4)}`;
    const now = new Date().toISOString();

    const newTenant: Tenant = {
      id: tenantId,
      name: data.name,
      legalName: data.legalName || data.name,
      code: data.code.toUpperCase(),
      status: 'active',
      isDeleted: false,
      email: data.email,
      phone: data.phone,
      settings: {
        currency: data.currency || 'USD',
        currencySymbol: data.currency === 'EUR' ? '€' : data.currency === 'GBP' ? '£' : '$',
        fiscalYearStartMonth: 1,
        timezone: data.timezone || 'UTC',
        dateFormat: 'YYYY-MM-DD',
        taxName: 'VAT',
        defaultTaxRate: 15.0,
        invoicePrefix: 'INV-',
        invoiceNextNumber: 1001,
        purchaseOrderPrefix: 'PO-',
        purchaseOrderNextNumber: 1001,
        enableRealtimeSync: true,
        allowNegativeInventory: false,
        enableLowStockAlerts: true,
        enableAutoInvoiceNumbering: true,
      },
      ownerId,
      createdAt: now,
      updatedAt: now,
    };

    if (isFirebaseConfigured()) {
      const db = getFirebaseFirestore();
      if (db) {
        await setDoc(doc(db, 'tenants', tenantId), newTenant);
        await setDoc(doc(db, `tenants/${tenantId}/users`, ownerId), {
          id: ownerId,
          tenantId,
          role: 'super_admin',
          status: 'active',
          createdAt: now,
        });
      }
    }

    const currentTenants = await this.getAllTenants();
    localReactiveStore.saveItems('global', 'tenants', [newTenant, ...currentTenants]);

    return newTenant;
  }

  static async updateTenant(
    tenantId: string,
    updates: {
      name?: string;
      legalName?: string;
      logoUrl?: string;
      email?: string;
      phone?: string;
      address?: TenantAddress;
      settings?: Partial<TenantSettings>;
    }
  ): Promise<Tenant> {
    const tenant = await this.getTenantById(tenantId);
    if (!tenant) throw new Error('Tenant not found');

    const now = new Date().toISOString();
    const updatedTenant: Tenant = {
      ...tenant,
      name: updates.name !== undefined ? updates.name : tenant.name,
      legalName: updates.legalName !== undefined ? updates.legalName : tenant.legalName,
      logoUrl: updates.logoUrl !== undefined ? updates.logoUrl : tenant.logoUrl,
      email: updates.email !== undefined ? updates.email : tenant.email,
      phone: updates.phone !== undefined ? updates.phone : tenant.phone,
      address: updates.address !== undefined ? { ...tenant.address, ...updates.address } : tenant.address,
      settings: updates.settings ? { ...tenant.settings, ...updates.settings } : tenant.settings,
      updatedAt: now,
    };

    if (isFirebaseConfigured()) {
      const db = getFirebaseFirestore();
      if (db) {
        await updateDoc(doc(db, 'tenants', tenantId), updatedTenant as unknown as Record<string, any>);
      }
    }

    const currentTenants = await this.getAllTenants();
    const list = currentTenants.map((t) => (t.id === tenantId ? updatedTenant : t));
    localReactiveStore.saveItems('global', 'tenants', list);

    return updatedTenant;
  }

  static async updateSettings(tenantId: string, settings: Partial<TenantSettings>): Promise<Tenant> {
    return this.updateTenant(tenantId, { settings });
  }
}

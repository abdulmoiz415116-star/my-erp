import { Product, Customer, Supplier } from '@/types/erp';
import { AuditLogEntry } from '@/types/audit';
import { TenantSettings } from '@/types/tenant';
import { SystemNotification, NotificationType } from '@/types/notification';

const READ_NOTIFICATIONS_KEY_PREFIX = 'erp_read_notifications_';

export function getReadNotificationIds(tenantId: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(`${READ_NOTIFICATIONS_KEY_PREFIX}${tenantId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function markNotificationAsRead(tenantId: string, notificationId: string): void {
  if (typeof window === 'undefined') return;
  const existing = getReadNotificationIds(tenantId);
  if (!existing.includes(notificationId)) {
    const updated = [...existing, notificationId];
    localStorage.setItem(`${READ_NOTIFICATIONS_KEY_PREFIX}${tenantId}`, JSON.stringify(updated));
    window.dispatchEvent(new Event('erp_notifications_updated'));
  }
}

export function markAllNotificationsAsRead(tenantId: string, notificationIds: string[]): void {
  if (typeof window === 'undefined') return;
  const existing = getReadNotificationIds(tenantId);
  const set = new Set([...existing, ...notificationIds]);
  localStorage.setItem(`${READ_NOTIFICATIONS_KEY_PREFIX}${tenantId}`, JSON.stringify(Array.from(set)));
  window.dispatchEvent(new Event('erp_notifications_updated'));
}

export function generateLiveNotifications({
  tenantId,
  products = [],
  customers = [],
  suppliers = [],
  auditLogs = [],
  settings,
}: {
  tenantId: string;
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  auditLogs: AuditLogEntry[];
  settings?: TenantSettings;
}): SystemNotification[] {
  const readIds = new Set(getReadNotificationIds(tenantId));
  const notifications: SystemNotification[] = [];

  const enableLowStock = settings?.enableLowStockAlerts !== false;
  const enableCustomerOverdue = settings?.enableCustomerOverdueAlerts !== false;
  const enableSupplierPayable = settings?.enableSupplierPayableAlerts !== false;
  const enableSystemEvents = settings?.enableSystemEventAlerts !== false;

  // 1. Low Stock Alerts
  if (enableLowStock) {
    products
      .filter((p) => !p.isDeleted && p.status === 'active')
      .forEach((p) => {
        const threshold = p.minStockAlert || 5;
        if (p.currentStock <= threshold) {
          const isZero = p.currentStock <= 0;
          const id = `notif-stock-${p.id}`;
          notifications.push({
            id,
            tenantId,
            type: 'low_stock',
            title: isZero ? `Out of Stock: ${p.name}` : `Low Stock Warning: ${p.name}`,
            message: isZero
              ? `Stock level has reached 0 units. SKU: ${p.sku}. Immediate replenishment required.`
              : `Current inventory (${p.currentStock} units) is at or below threshold (${threshold} units).`,
            severity: isZero ? 'error' : 'warning',
            link: '/products',
            read: readIds.has(id),
            createdAt: p.updatedAt || p.createdAt || new Date().toISOString(),
            entityId: p.id,
          });
        }
      });
  }

  // 2. Customer Overdue / Outstanding Balance Alerts
  if (enableCustomerOverdue) {
    customers
      .filter((c) => !c.isDeleted && c.status === 'active' && (c.currentBalance || 0) > 0)
      .forEach((c) => {
        const exceedsCredit = c.creditLimit > 0 && c.currentBalance >= c.creditLimit;
        const id = `notif-cust-${c.id}`;
        notifications.push({
          id,
          tenantId,
          type: 'customer_overdue',
          title: exceedsCredit ? `Credit Limit Exceeded: ${c.name}` : `Outstanding Balance: ${c.name}`,
          message: exceedsCredit
            ? `Customer has reached or exceeded approved credit limit ($${c.currentBalance.toFixed(2)} / $${c.creditLimit.toFixed(2)}).`
            : `Unsettled customer receivable balance of $${c.currentBalance.toFixed(2)} pending collection.`,
          severity: exceedsCredit ? 'error' : 'warning',
          link: '/customers',
          read: readIds.has(id),
          createdAt: c.updatedAt || c.createdAt || new Date().toISOString(),
          entityId: c.id,
        });
      });
  }

  // 3. Supplier Outstanding Payable Alerts
  if (enableSupplierPayable) {
    suppliers
      .filter((s) => !s.isDeleted && s.status === 'active' && (s.currentBalance || 0) > 0)
      .forEach((s) => {
        const id = `notif-supp-${s.id}`;
        notifications.push({
          id,
          tenantId,
          type: 'supplier_payable',
          title: `Pending Supplier Payable: ${s.companyName || s.name}`,
          message: `Outstanding trade payable of $${s.currentBalance.toFixed(2)} owed to vendor.`,
          severity: 'info',
          link: '/suppliers',
          read: readIds.has(id),
          createdAt: s.updatedAt || s.createdAt || new Date().toISOString(),
          entityId: s.id,
        });
      });
  }

  // 4. Important System Events (from recent audit logs)
  if (enableSystemEvents) {
    const criticalActions = ['POST', 'CANCEL', 'STATUS_CHANGE', 'SETTINGS_CHANGE', 'STOCK_ADJUSTMENT'];
    auditLogs
      .filter((a) => !a.isDeleted && criticalActions.includes(a.action))
      .slice(0, 5) // top 5 recent critical events
      .forEach((a) => {
        const id = `notif-audit-${a.id}`;
        notifications.push({
          id,
          tenantId,
          type: 'system_event',
          title: `System Event: ${a.action} (${a.module})`,
          message: `${a.description} by ${a.userName || 'System Operator'}.`,
          severity: a.action === 'CANCEL' ? 'warning' : 'info',
          link: '/audit-logs',
          read: readIds.has(id),
          createdAt: a.timestamp || a.createdAt || new Date().toISOString(),
          entityId: a.id,
        });
      });
  }

  // Sort: unread first, then by date descending
  return notifications.sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

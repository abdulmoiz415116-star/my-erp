export type NotificationType =
  | 'low_stock'
  | 'customer_overdue'
  | 'supplier_payable'
  | 'system_event';

export type NotificationSeverity = 'info' | 'warning' | 'error' | 'success';

export interface SystemNotification {
  id: string;
  tenantId: string;
  type: NotificationType;
  title: string;
  message: string;
  severity: NotificationSeverity;
  link?: string;
  read: boolean;
  createdAt: string;
  entityId?: string;
}

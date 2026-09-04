'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/context/TenantContext';
import { useRealtimeCollection } from '@/hooks/useRealtimeCollection';
import { ProductService, CustomerService, SupplierService, AuditLogService } from '@/services/erp.service';
import { Product, Customer, Supplier } from '@/types/erp';
import { AuditLogEntry } from '@/types/audit';
import { SystemNotification } from '@/types/notification';
import {
  generateLiveNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/services/notification.service';
import { formatDateTime } from '@/lib/utils';
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  ExternalLink,
  Package,
  Users,
  Building,
  History,
  X,
} from 'lucide-react';

export function NotificationDrawer() {
  const router = useRouter();
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id || 'tenant-apex-corp';

  const [isOpen, setIsOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'unread'>('all');
  const [readVersion, setReadVersion] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);

  // Real-time collections for dynamic notifications
  const { allItems: products } = useRealtimeCollection<Product>((tId) => new ProductService(tId));
  const { allItems: customers } = useRealtimeCollection<Customer>((tId) => new CustomerService(tId));
  const { allItems: suppliers } = useRealtimeCollection<Supplier>((tId) => new SupplierService(tId));
  const { allItems: auditLogs } = useRealtimeCollection<AuditLogEntry>((tId) => new AuditLogService(tId));

  // Listen to read state changes
  useEffect(() => {
    const handleUpdate = () => setReadVersion((v) => v + 1);
    window.addEventListener('erp_notifications_updated', handleUpdate);
    return () => window.removeEventListener('erp_notifications_updated', handleUpdate);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Derive notifications
  const notifications: SystemNotification[] = useMemo(() => {
    return generateLiveNotifications({
      tenantId,
      products,
      customers,
      suppliers,
      auditLogs,
      settings: currentTenant?.settings,
    });
    // readVersion included so read toggles immediately refresh
  }, [tenantId, products, customers, suppliers, auditLogs, currentTenant?.settings, readVersion]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (filterTab === 'unread') {
      return notifications.filter((n) => !n.read);
    }
    return notifications;
  }, [notifications, filterTab]);

  const handleMarkAllRead = () => {
    const ids = notifications.map((n) => n.id);
    markAllNotificationsAsRead(tenantId, ids);
  };

  const handleNotificationClick = (notif: SystemNotification) => {
    if (!notif.read) {
      markNotificationAsRead(tenantId, notif.id);
    }
    setIsOpen(false);
    if (notif.link) {
      router.push(notif.link);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />;
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />;
      default:
        return <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'low_stock':
        return <Package className="w-3.5 h-3.5 text-amber-600" />;
      case 'customer_overdue':
        return <Users className="w-3.5 h-3.5 text-rose-600" />;
      case 'supplier_payable':
        return <Building className="w-3.5 h-3.5 text-blue-600" />;
      default:
        return <History className="w-3.5 h-3.5 text-slate-600" />;
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
        title="Live System Notifications"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown / Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-400" />
              <span className="font-bold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] text-indigo-300 hover:text-white flex items-center gap-1 font-medium transition-colors"
                title="Mark all as read"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100 bg-slate-50/70 px-4 pt-2">
            <button
              onClick={() => setFilterTab('all')}
              className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors ${
                filterTab === 'all'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilterTab('unread')}
              className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors ${
                filterTab === 'unread'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-700">All caught up!</p>
                <p className="text-[11px] text-slate-400 mt-0.5">No new operational alerts at this time.</p>
              </div>
            ) : (
              filteredNotifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3.5 flex items-start gap-3 cursor-pointer hover:bg-slate-50 transition-colors relative group ${
                    !notif.read ? 'bg-indigo-50/40' : 'bg-white'
                  }`}
                >
                  {/* Read dot indicator */}
                  {!notif.read && (
                    <span className="absolute left-1.5 top-5 w-1.5 h-1.5 rounded-full bg-indigo-600" />
                  )}

                  {getSeverityIcon(notif.severity)}

                  <div className="flex-1 min-w-0 pl-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="p-0.5 rounded bg-slate-100">{getTypeIcon(notif.type)}</span>
                        <p className="text-xs font-bold text-slate-900 truncate">{notif.title}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono shrink-0">
                        {formatDateTime(notif.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 mt-1 leading-snug line-clamp-2">
                      {notif.message}
                    </p>

                    {notif.link && (
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-indigo-600 group-hover:text-indigo-800 flex items-center gap-1">
                          View details <ExternalLink className="w-3 h-3" />
                        </span>
                        {!notif.read && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markNotificationAsRead(tenantId, notif.id);
                            }}
                            className="text-[10px] text-slate-400 hover:text-slate-700 font-medium"
                          >
                            Dismiss
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer with link to settings */}
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="text-[11px]">Real-time operational alerts</span>
            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Alert Settings →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

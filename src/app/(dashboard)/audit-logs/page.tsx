'use client';

import React, { useState, useMemo } from 'react';
import { useTenant } from '@/context/TenantContext';
import { AuditLogService } from '@/services/erp.service';
import { AuditLogEntry, AuditAction } from '@/types/audit';
import { useRealtimeCollection } from '@/hooks/useRealtimeCollection';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { formatDateTime, formatDate } from '@/lib/utils';
import {
  History,
  Shield,
  Lock,
  Search,
  Filter,
  Eye,
  Download,
  Printer,
  Calendar,
  User,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Activity,
} from 'lucide-react';

export default function AuditLogsPage() {
  const { currentTenant } = useTenant();

  // Filters State
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'this_week' | 'this_month'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination & Sorting
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Inspect Modal State
  const [inspectEntry, setInspectEntry] = useState<AuditLogEntry | null>(null);

  // Real-time audit logs collection
  const { allItems: auditLogs, loading } = useRealtimeCollection<AuditLogEntry>(
    (tenantId) => new AuditLogService(tenantId),
    {
      sortBy: 'timestamp',
      sortDirection: 'desc',
    }
  );

  // Date filter helper
  const isDateInFilter = (dateStr: string) => {
    if (dateFilter === 'all') return true;
    const d = new Date(dateStr);
    const now = new Date();

    if (dateFilter === 'today') {
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    }

    if (dateFilter === 'this_week') {
      const startOfWeek = new Date(now);
      const day = now.getDay() || 7;
      startOfWeek.setDate(now.getDate() - day + 1);
      startOfWeek.setHours(0, 0, 0, 0);
      return d >= startOfWeek && d <= now;
    }

    if (dateFilter === 'this_month') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }

    return true;
  };

  // Distinct Modules for Filter Dropdown
  const availableModules = useMemo(() => {
    const set = new Set<string>();
    auditLogs.forEach((l) => {
      if (l.module) set.add(l.module);
    });
    return Array.from(set).sort();
  }, [auditLogs]);

  // Filtered Collection
  const filteredLogs = useMemo(() => {
    return auditLogs
      .filter((l) => !l.isDeleted)
      .filter((l) => isDateInFilter(l.timestamp))
      .filter((l) => (selectedAction === 'all' ? true : l.action === selectedAction))
      .filter((l) => (selectedModule === 'all' ? true : l.module.toLowerCase() === selectedModule.toLowerCase()))
      .filter((l) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          l.description.toLowerCase().includes(q) ||
          (l.entityName && l.entityName.toLowerCase().includes(q)) ||
          (l.recordId && l.recordId.toLowerCase().includes(q)) ||
          l.userName.toLowerCase().includes(q) ||
          l.userEmail.toLowerCase().includes(q) ||
          l.module.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const factor = sortDirection === 'asc' ? 1 : -1;
        return (new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) * factor;
      });
  }, [auditLogs, selectedAction, selectedModule, dateFilter, searchQuery, sortDirection]);

  // Pagination
  const totalItems = filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Timestamp', 'Action', 'Module', 'Record / Entity', 'Description', 'Actor Name', 'Actor Email', 'IP Address'];
    const rows = filteredLogs.map((l) => [
      formatDateTime(l.timestamp),
      l.action,
      l.module,
      `"${(l.recordId || l.entityName || l.entityId || '—').replace(/"/g, '""')}"`,
      `"${l.description.replace(/"/g, '""')}"`,
      `"${l.userName.replace(/"/g, '""')}"`,
      l.userEmail,
      l.ipAddress || '—',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `audit_trail_${currentTenant?.id || 'tenant'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'POST':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'PAYMENT':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'STOCK_ADJUSTMENT':
        return 'bg-cyan-50 text-cyan-700 border-cyan-200';
      case 'UPDATE':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'STATUS_CHANGE':
      case 'DISABLE':
      case 'ENABLE':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'CANCEL':
      case 'SOFT_DELETE':
      case 'HARD_DELETE':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl pb-16">
      {/* Header with Security Badge and Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Immutable Audit & Forensic Activity Log"
          subtitle={`Append-only forensic event trail for enterprise workspace: ${currentTenant?.name}`}
          badge={
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <Lock className="w-3 h-3" />
              Append-Only Security (Read Only)
            </span>
          }
        />
        <div className="flex items-center gap-2.5 print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-xs font-semibold"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            Print Log
          </Button>
          <Button
            size="sm"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export Audit Trail (CSV)
          </Button>
        </div>
      </div>

      {/* Security Immutability Alert Banner */}
      <div className="bg-slate-900 text-slate-200 p-4 rounded-xl border border-slate-800 shadow-xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Cryptographically Guarded Ledger
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Normal users and administrators cannot edit, alter, or delete audit logs. Every user action, status shift, payment, and posting is permanently indexed.
            </p>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-4 text-xs font-mono text-slate-400">
          <div>
            <span className="block text-[10px] uppercase text-slate-500">Indexed Logs:</span>
            <span className="font-bold text-white text-sm">{auditLogs.length}</span>
          </div>
        </div>
      </div>

      {/* Multi-Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          {/* Action Filter */}
          <div className="flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-slate-400" />
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none"
            >
              <option value="all">All Actions</option>
              <option value="CREATE">CREATE</option>
              <option value="POST">POST (Voucher/Sale)</option>
              <option value="PAYMENT">PAYMENT</option>
              <option value="STOCK_ADJUSTMENT">STOCK ADJUSTMENT</option>
              <option value="UPDATE">UPDATE</option>
              <option value="STATUS_CHANGE">STATUS CHANGE</option>
              <option value="CANCEL">CANCEL / VOID</option>
              <option value="SOFT_DELETE">DELETE</option>
            </select>
          </div>

          {/* Module Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedModule}
              onChange={(e) => {
                setSelectedModule(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none"
            >
              <option value="all">All Target Modules</option>
              {availableModules.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
            </select>
          </div>

          {/* Search Query */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by description, record #, user, or entity..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="text-[11px] text-slate-500 flex items-center justify-between">
          <span>Showing {filteredLogs.length} audit entries matching active criteria</span>
          <button
            onClick={() => setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))}
            className="text-indigo-600 hover:text-indigo-800 font-semibold"
          >
            Order: {sortDirection === 'desc' ? 'Newest First (Chronological Descending)' : 'Oldest First (Ascending)'}
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
            <tr>
              <th className="p-3">Timestamp</th>
              <th className="p-3">Action</th>
              <th className="p-3">Module</th>
              <th className="p-3">Target / Record #</th>
              <th className="p-3">Description</th>
              <th className="p-3">Actor (User)</th>
              <th className="p-3 text-center print:hidden">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedLogs.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-400">
                  No audit log entries matching filter criteria.
                </td>
              </tr>
            ) : (
              paginatedLogs.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3 font-mono text-slate-600 text-[11px] whitespace-nowrap">
                    {formatDateTime(item.timestamp)}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${getActionBadge(
                        item.action
                      )}`}
                    >
                      {item.action}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-slate-700 font-semibold uppercase text-[11px]">
                    {item.module}
                  </td>
                  <td className="p-3 font-mono font-bold text-indigo-600">
                    {item.recordId || item.entityId || '—'}
                  </td>
                  <td className="p-3 text-slate-800">
                    <p className="font-medium text-xs leading-snug">{item.description}</p>
                    {item.entityName && (
                      <p className="text-[11px] text-slate-500 font-sans mt-0.5">
                        Entity: {item.entityName}
                      </p>
                    )}
                  </td>
                  <td className="p-3">
                    <p className="font-semibold text-slate-800 text-xs">{item.userName}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{item.userEmail}</p>
                  </td>
                  <td className="p-3 text-center print:hidden">
                    <button
                      onClick={() => setInspectEntry(item)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md transition-colors"
                      title="Inspect record values and forensic metadata"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Inspect
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalItems > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs print:hidden">
          <div className="text-slate-500">
            Showing <span className="font-semibold text-slate-800">{(currentPage - 1) * pageSize + 1}</span> to{' '}
            <span className="font-semibold text-slate-800">{Math.min(totalItems, currentPage * pageSize)}</span> of{' '}
            <span className="font-semibold text-slate-800">{totalItems}</span> entries
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700 focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 h-auto"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="px-2 font-mono font-semibold text-slate-700">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 h-auto"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* INSPECT AUDIT ENTRY MODAL (DIFF VIEWER) */}
      {inspectEntry && (
        <Modal
          isOpen={!!inspectEntry}
          onClose={() => setInspectEntry(null)}
          title={`Audit Forensic Record: ${inspectEntry.recordId || inspectEntry.entityId || inspectEntry.id}`}
          description={`Timestamp: ${formatDateTime(inspectEntry.timestamp)} • Action: ${inspectEntry.action} • Module: ${inspectEntry.module}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            {/* Action and description header */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center gap-1 font-mono text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${getActionBadge(
                    inspectEntry.action
                  )}`}
                >
                  {inspectEntry.action}
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {formatDateTime(inspectEntry.timestamp)}
                </span>
              </div>
              <p className="font-semibold text-slate-900 text-sm">{inspectEntry.description}</p>
              {inspectEntry.entityName && (
                <p className="text-slate-600 text-[11px]">
                  Target Entity Name: <span className="font-semibold text-slate-800">{inspectEntry.entityName}</span>
                </p>
              )}
            </div>

            {/* Side-by-side Before / After Diff */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-2">
                <History className="w-3.5 h-3.5 text-indigo-600" />
                Audit Value State Comparison (Previous vs New)
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Previous Value */}
                <div className="bg-rose-50/50 border border-rose-200 rounded-lg p-3 space-y-1.5">
                  <div className="font-bold text-rose-800 uppercase text-[10px] flex items-center justify-between">
                    <span>Previous Value (Before)</span>
                    <span className="text-[9px] bg-rose-200/60 text-rose-800 px-1.5 py-0.2 rounded font-mono">Prior State</span>
                  </div>
                  {inspectEntry.previousValue !== undefined && inspectEntry.previousValue !== null ? (
                    <pre className="p-2 bg-white rounded border border-rose-100 font-mono text-[11px] text-slate-800 overflow-x-auto max-h-48 whitespace-pre-wrap">
                      {typeof inspectEntry.previousValue === 'object'
                        ? JSON.stringify(inspectEntry.previousValue, null, 2)
                        : String(inspectEntry.previousValue)}
                    </pre>
                  ) : (
                    <p className="text-slate-400 italic p-2 bg-white rounded border border-slate-100 text-[11px]">
                      None (Initial creation or non-mutating event)
                    </p>
                  )}
                </div>

                {/* New Value */}
                <div className="bg-emerald-50/50 border border-emerald-200 rounded-lg p-3 space-y-1.5">
                  <div className="font-bold text-emerald-800 uppercase text-[10px] flex items-center justify-between">
                    <span>New Value (After)</span>
                    <span className="text-[9px] bg-emerald-200/60 text-emerald-800 px-1.5 py-0.2 rounded font-mono">Applied State</span>
                  </div>
                  {inspectEntry.newValue !== undefined && inspectEntry.newValue !== null ? (
                    <pre className="p-2 bg-white rounded border border-emerald-100 font-mono text-[11px] text-slate-800 overflow-x-auto max-h-48 whitespace-pre-wrap">
                      {typeof inspectEntry.newValue === 'object'
                        ? JSON.stringify(inspectEntry.newValue, null, 2)
                        : String(inspectEntry.newValue)}
                    </pre>
                  ) : (
                    <p className="text-slate-400 italic p-2 bg-white rounded border border-slate-100 text-[11px]">
                      No new state recorded
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Forensic Actor & Network Metadata */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Forensic Origin & Actor Credentials
              </h4>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block">Operator Name:</span>
                  <span className="font-bold text-slate-800">{inspectEntry.userName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Operator Email:</span>
                  <span className="font-mono text-slate-800">{inspectEntry.userEmail}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">IP Address:</span>
                  <span className="font-mono text-slate-800">{inspectEntry.ipAddress || '127.0.0.1 (Local)'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">User UID:</span>
                  <span className="font-mono text-slate-800 truncate block">{inspectEntry.userId}</span>
                </div>
                {inspectEntry.userAgent && (
                  <div className="col-span-2">
                    <span className="text-slate-400 block">User Agent:</span>
                    <span className="font-mono text-slate-600 text-[10px] break-all">{inspectEntry.userAgent}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
              <Button
                type="button"
                onClick={() => setInspectEntry(null)}
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold"
              >
                Close Inspector
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

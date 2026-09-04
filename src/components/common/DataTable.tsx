'use client';

import React, { ReactNode, useState } from 'react';
import { BaseEntity, RecordStatus } from '@/types/common';
import { StatusBadge } from './StatusBadge';
import { Button } from '@/components/ui/Button';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Power,
  Trash2,
  Edit2,
  Eye,
  Filter,
  MoreVertical,
} from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

export interface Column<T> {
  key?: string;
  accessor?: string;
  header: string;
  sortable?: boolean;
  render?: (item: T) => ReactNode;
  cell?: (item: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export interface DataTableProps<T extends BaseEntity> {
  columns: Column<T>[];
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  loading?: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter?: RecordStatus | 'all';
  onStatusFilterChange?: (status: RecordStatus | 'all') => void;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
  onSortChange: (field: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onView?: (item: T) => void;
  onEdit?: (item: T) => void;
  onToggleStatus?: (id: string, newStatus: RecordStatus) => Promise<unknown> | void;
  onDelete?: (id: string) => Promise<unknown> | void;
  title?: string;
  description?: string;
  actions?: ReactNode;
  emptyMessage?: string;
}

export function DataTable<T extends BaseEntity>({
  columns,
  data,
  totalCount,
  page,
  pageSize,
  totalPages,
  loading = false,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  sortDirection,
  onSortChange,
  onPageChange,
  onPageSizeChange,
  onView,
  onEdit,
  onToggleStatus,
  onDelete,
  title,
  description,
  actions,
  emptyMessage = 'No records found matching your filters.',
}: DataTableProps<T>) {
  // Confirmation state for status change or deletion
  const [confirmTarget, setConfirmTarget] = useState<{
    type: 'toggle' | 'delete';
    id: string;
    status?: RecordStatus;
    name?: string;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const handleExportCSV = () => {
    if (data.length === 0) return;
    const headers = columns.map((col) => `"${col.header.replace(/"/g, '""')}"`).join(',');
    const rows = data.map((item) =>
      columns
        .map((col) => {
          const colKey = col.key || col.accessor || '';
          const val = colKey ? (item as unknown as Record<string, unknown>)[colKey] : '';
          if (val === undefined || val === null) return '""';
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(',')
    );

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${title || 'export'}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConfirmAction = async () => {
    if (!confirmTarget) return;
    setActionLoading(true);
    try {
      if (confirmTarget.type === 'toggle' && onToggleStatus) {
        const nextStatus: RecordStatus = confirmTarget.status === 'active' ? 'inactive' : 'active';
        await onToggleStatus(confirmTarget.id, nextStatus);
      } else if (confirmTarget.type === 'delete' && onDelete) {
        await onDelete(confirmTarget.id);
      }
      setConfirmTarget(null);
    } finally {
      setActionLoading(false);
    }
  };

  const startRecord = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRecord = Math.min(page * pageSize, totalCount);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header & Controls Section */}
      <div className="p-5 border-b border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            {title && <h2 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h2>}
            {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={data.length === 0}
              title="Export filtered records to CSV"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
            {actions}
          </div>
        </div>

        {/* Search, Status Tabs & Filters Bar */}
        <div className="mt-4 flex flex-col md:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
          {/* Real-time search bar */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search across records..."
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                onPageChange(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
            />
          </div>

          {/* Status Tabs: All | Active | Inactive */}
          {onStatusFilterChange && (
            <div className="flex items-center gap-1 self-stretch md:self-auto bg-slate-100 p-1 rounded-lg border border-slate-200/60">
              <button
                onClick={() => {
                  onStatusFilterChange('all');
                  onPageChange(1);
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  statusFilter === 'all'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Records
              </button>
              <button
                onClick={() => {
                  onStatusFilterChange('active');
                  onPageChange(1);
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                  statusFilter === 'active'
                    ? 'bg-white text-emerald-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Active
              </button>
              <button
                onClick={() => {
                  onStatusFilterChange('inactive');
                  onPageChange(1);
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                  statusFilter === 'inactive'
                    ? 'bg-white text-slate-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                Inactive
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              {columns.map((col, cIdx) => {
                const colKey = col.key || col.accessor || `col-${cIdx}`;
                return (
                  <th
                    key={colKey}
                    className={`py-3 px-4 ${col.className || ''} ${
                      col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {col.sortable ? (
                      <button
                        onClick={() => onSortChange(colKey)}
                        className="inline-flex items-center gap-1 hover:text-slate-900 focus:outline-none transition-colors"
                      >
                        {col.header}
                        {sortBy === colKey ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp className="w-3.5 h-3.5 text-indigo-600" />
                          ) : (
                            <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-300 opacity-60" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
              <th className="py-3 px-4 text-center">Status</th>
              {(onView || onEdit || onToggleStatus || onDelete) && <th className="py-3 px-4 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {loading ? (
              <tr>
                <td colSpan={columns.length + 2} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    <span>Synchronizing real-time data...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 2} className="py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Filter className="w-8 h-8 text-slate-300" />
                    <p className="font-medium text-slate-600">{emptyMessage}</p>
                    <p className="text-slate-400 text-[11px]">
                      Try clearing search filters or create a new record.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                  {columns.map((col, cIdx) => {
                    const colKey = col.key || col.accessor || `col-${cIdx}`;
                    const content = col.render
                      ? col.render(item)
                      : col.cell
                      ? col.cell(item)
                      : ((item as unknown as Record<string, unknown>)[colKey] as ReactNode) ?? '—';
                    return (
                      <td
                        key={`${item.id}-${colKey}`}
                        className={`py-3 px-4 text-slate-700 ${col.className || ''} ${
                          col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'
                        }`}
                      >
                        {content}
                      </td>
                    );
                  })}
                  {/* Status column with toggle badge */}
                  <td className="py-3 px-4 text-center">
                    <StatusBadge
                      status={item.status}
                      onClick={() =>
                        onToggleStatus &&
                        setConfirmTarget({
                          type: 'toggle',
                          id: item.id,
                          status: item.status,
                          name: (item as unknown as { name?: string }).name,
                        })
                      }
                    />
                  </td>
                  {/* Actions column */}
                  {(onView || onEdit || onToggleStatus || onDelete) && (
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        {onView && (
                          <button
                            onClick={() => onView(item)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                            title="View Profile & Ledger"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onEdit && (
                          <button
                            onClick={() => onEdit(item)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                            title="Edit Record"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onToggleStatus && (
                          <button
                            onClick={() =>
                              setConfirmTarget({
                                type: 'toggle',
                                id: item.id,
                                status: item.status,
                                name: (item as unknown as { name?: string }).name,
                              })
                            }
                            className={`p-1.5 rounded-md transition-colors ${
                              item.status === 'active'
                                ? 'text-slate-500 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={item.status === 'active' ? 'Disable (Deactivate)' : 'Enable (Activate)'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() =>
                              setConfirmTarget({
                                type: 'delete',
                                id: item.id,
                                name: (item as unknown as { name?: string }).name,
                              })
                            }
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                            title="Deactivate & Soft Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <span>
            Showing <strong className="font-semibold text-slate-700">{startRecord}</strong> to{' '}
            <strong className="font-semibold text-slate-700">{endRecord}</strong> of{' '}
            <strong className="font-semibold text-slate-700">{totalCount}</strong> entries
          </span>
          <div className="flex items-center gap-1.5">
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="bg-white border border-slate-200 rounded px-2 py-0.5 text-slate-700 focus:outline-none focus:border-indigo-500"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
            className="h-8 px-2 text-xs"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Previous
          </Button>

          <span className="px-2 text-slate-600">
            Page {page} of {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(page + 1)}
            className="h-8 px-2 text-xs"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Dynamic Action Confirmation Modal */}
      {confirmTarget && (
        <ConfirmModal
          isOpen={true}
          onClose={() => setConfirmTarget(null)}
          onConfirm={handleConfirmAction}
          loading={actionLoading}
          variant={
            confirmTarget.type === 'delete'
              ? 'danger'
              : confirmTarget.status === 'active'
              ? 'warning'
              : 'primary'
          }
          title={
            confirmTarget.type === 'delete'
              ? 'Confirm Deactivation'
              : confirmTarget.status === 'active'
              ? 'Disable Master Record'
              : 'Enable Master Record'
          }
          message={
            confirmTarget.type === 'delete'
              ? `Are you sure you want to deactivate and soft-delete this record${
                  confirmTarget.name ? ` "${confirmTarget.name}"` : ''
                }? It will be marked inactive and hidden from operational views while preserving financial audit trails.`
              : confirmTarget.status === 'active'
              ? `Are you sure you want to set this record to Inactive? It will be disabled for active transactions until re-enabled.`
              : `Are you sure you want to activate this record? It will immediately become available across all active modules.`
          }
          confirmText={
            confirmTarget.type === 'delete'
              ? 'Deactivate'
              : confirmTarget.status === 'active'
              ? 'Disable'
              : 'Enable'
          }
        />
      )}
    </div>
  );
}

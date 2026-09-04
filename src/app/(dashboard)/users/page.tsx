'use client';

import React, { useState, useMemo } from 'react';
import { useTenant } from '@/context/TenantContext';
import { usePermissions } from '@/hooks/usePermissions';
import { TenantUserService } from '@/services/erp.service';
import { TenantUser, TenantRole } from '@/types/tenant';
import { RecordStatus } from '@/types/common';
import { getRolePermissions } from '@/types/permissions';
import { useRealtimeCollection } from '@/hooks/useRealtimeCollection';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, Column } from '@/components/common/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatDate, formatDateTime } from '@/lib/utils';
import {
  Plus,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  Eye,
  Mail,
  Phone,
  Calendar,
  Lock,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { useToast } from '@/context/ToastContext';

export default function UsersPage() {
  const { currentTenant, userRole } = useTenant();
  const { can, isSuperAdmin, isAdmin } = usePermissions();
  const { showToast } = useToast();

  const {
    items,
    allItems,
    totalCount,
    loading,
    page,
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
  } = useRealtimeCollection<TenantUser>((tenantId) => new TenantUserService(tenantId));

  // Role Filter State
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');

  // Modals State
  const [modalOpen, setModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<TenantUser | null>(null);
  const [viewingUser, setViewingUser] = useState<TenantUser | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<TenantRole>('staff');

  // Filter items by role additionally
  const displayedItems = useMemo(() => {
    if (selectedRoleFilter === 'all') return items;
    return items.filter((u) => {
      if (selectedRoleFilter === 'super_admin') return u.role === 'super_admin' || u.role === 'owner';
      return u.role === selectedRoleFilter;
    });
  }, [items, selectedRoleFilter]);

  const openCreateModal = () => {
    setEditingUser(null);
    setEmail('');
    setDisplayName('');
    setPhone('');
    setRole('staff');
    setModalOpen(true);
  };

  const openEditModal = (u: TenantUser) => {
    if (!isAdmin) {
      showToast('You do not have permission to edit users.', 'error');
      return;
    }
    // Only Super Admin can edit another Super Admin
    if ((u.role === 'super_admin' || u.role === 'owner') && !isSuperAdmin) {
      showToast('Only Super Administrators can modify Super Admin accounts.', 'error');
      return;
    }

    setEditingUser(u);
    setEmail(u.email);
    setDisplayName(u.displayName);
    setPhone(u.phone || '');
    setRole(u.role === 'owner' ? 'super_admin' : u.role);
    setModalOpen(true);
  };

  const openViewModal = (u: TenantUser) => {
    setViewingUser(u);
    setViewModalOpen(true);
  };

  const handleToggleUserStatus = async (id: string, nextStatus: RecordStatus) => {
    const target = allItems.find((u) => u.id === id);
    if (!target) return;

    if (!can('users:status')) {
      showToast('Unauthorized: You lack users:status permission.', 'error');
      return;
    }

    if ((target.role === 'super_admin' || target.role === 'owner') && !isSuperAdmin) {
      showToast('Security Violation: Admins cannot disable Super Admin accounts.', 'error');
      return;
    }

    await toggleStatus(id, nextStatus);
  };

  const handleDeleteUser = async (id: string) => {
    const target = allItems.find((u) => u.id === id);
    if (!target) return;

    if (!can('users:delete')) {
      showToast('Unauthorized: You lack users:delete permission.', 'error');
      return;
    }

    if ((target.role === 'super_admin' || target.role === 'owner') && !isSuperAdmin) {
      showToast('Security Violation: Admins cannot delete Super Admin accounts.', 'error');
      return;
    }

    await softDeleteItem(id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !displayName) return;

    setSubmitting(true);
    try {
      if (editingUser) {
        await updateItem(editingUser.id, {
          displayName,
          phone: phone || undefined,
          role,
        });
      } else {
        await createItem({
          email,
          displayName,
          phone: phone || undefined,
          role,
          status: 'active',
        });
      }
      setModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleBadge = (r: TenantRole) => {
    const normalized = r === 'owner' ? 'super_admin' : r;
    const styles = {
      super_admin: 'bg-purple-50 text-purple-700 border-purple-200',
      owner: 'bg-purple-50 text-purple-700 border-purple-200',
      admin: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      manager: 'bg-blue-50 text-blue-700 border-blue-200',
      staff: 'bg-slate-100 text-slate-700 border-slate-200',
      accountant: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    }[normalized] || 'bg-slate-100 text-slate-700 border-slate-200';

    const label = {
      super_admin: 'Super Admin',
      owner: 'Super Admin',
      admin: 'Admin',
      manager: 'Manager',
      staff: 'Staff',
      accountant: 'Accountant',
    }[normalized] || r;

    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase font-mono border ${styles}`}>
        <Shield className="w-3 h-3" />
        {label}
      </span>
    );
  };

  const columns: Column<TenantUser>[] = [
    {
      key: 'displayName',
      header: 'Team Member',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0">
            {item.displayName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900">{item.displayName}</span>
            </div>
            <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
              <Mail className="w-3 h-3 text-slate-400" />
              {item.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Assigned Role',
      sortable: true,
      align: 'center',
      render: (item) => getRoleBadge(item.role),
    },
    {
      key: 'phone',
      header: 'Contact Phone',
      render: (item) => (
        <span className="text-slate-600 text-xs font-mono">{item.phone || '—'}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Membership Date',
      sortable: true,
      render: (item) => (
        <span className="text-slate-500 font-mono text-[11px]">
          {formatDate(item.createdAt)}
        </span>
      ),
    },
    {
      key: 'actions_view',
      header: 'Details',
      align: 'center',
      render: (item) => (
        <button
          onClick={() => openViewModal(item)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          View
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenant Users & Access Governance"
        subtitle={`Role-based member directory with real-time status management for ${currentTenant?.name}`}
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5" />
            Backend Enforced RBAC
          </span>
        }
        actions={
          can('users:create') && (
            <Button size="sm" onClick={openCreateModal}>
              <Plus className="w-4 h-4" />
              Add User Member
            </Button>
          )
        }
      />

      {/* Role Filtering Sub-bar */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-white rounded-xl border border-slate-200 text-xs shadow-2xs">
        <span className="text-slate-500 font-semibold flex items-center gap-1.5 px-1">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          Role Filter:
        </span>
        {[
          { key: 'all', label: 'All Roles' },
          { key: 'super_admin', label: 'Super Admin' },
          { key: 'admin', label: 'Admin' },
          { key: 'manager', label: 'Manager' },
          { key: 'staff', label: 'Staff' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelectedRoleFilter(tab.key)}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              selectedRoleFilter === tab.key
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <DataTable<TenantUser>
        columns={columns}
        data={displayedItems}
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        loading={loading}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSortChange={(f) => {
          if (sortBy === f) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
          else {
            setSortBy(f);
            setSortDirection('asc');
          }
        }}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onEdit={can('users:edit') ? openEditModal : undefined}
        onToggleStatus={can('users:status') ? handleToggleUserStatus : undefined}
        onDelete={can('users:delete') ? handleDeleteUser : undefined}
        title="Workspace Members"
        description="Every member's status and permissions are enforced in real time."
      />

      {/* Add / Edit User Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingUser ? `Edit Member: ${editingUser.displayName}` : 'Add New Member to Workspace'}
        description="The user will be provisioned with tenant-scoped permissions strictly within this company."
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            placeholder="e.g. Johnathan Miller"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />

          <Input
            label="Enterprise Email"
            type="email"
            placeholder="johnathan@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={Boolean(editingUser)}
            helperText={editingUser ? 'Email identity cannot be changed once provisioned.' : undefined}
            required
          />

          <Input
            label="Contact Phone"
            placeholder="+1 (555) 019-2831"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <div>
            <Select
              label="Assigned System Role"
              value={role}
              onChange={(e) => setRole(e.target.value as TenantRole)}
              options={[
                { value: 'staff', label: 'Staff — Operational Data Entry (Sales, Purchases, Catalog)' },
                { value: 'manager', label: 'Manager — Approvals, Operations, and View Members' },
                { value: 'admin', label: 'Admin — User Management, Master Data, & Tenant Operations' },
                ...(isSuperAdmin
                  ? [{ value: 'super_admin', label: 'Super Admin — Unrestricted Root Control' }]
                  : []),
              ]}
            />

            {/* Role Permissions Summary Preview */}
            <div className="mt-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-500 font-mono block">
                Preview Granted Role Capabilities:
              </span>
              <div className="flex flex-wrap gap-1 mt-1.5 max-h-24 overflow-y-auto">
                {getRolePermissions(role).map((p) => (
                  <span
                    key={p}
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white text-slate-700 border border-slate-200"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={submitting}>
              {editingUser ? 'Update Member' : 'Provision Member'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* View User Modal */}
      {viewingUser && (
        <Modal
          isOpen={viewModalOpen}
          onClose={() => setViewModalOpen(false)}
          title={`Member Details: ${viewingUser.displayName}`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            {/* Header info */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-lg">
                {viewingUser.displayName.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-slate-900 text-sm">{viewingUser.displayName}</h4>
                  <StatusBadge status={viewingUser.status} />
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{viewingUser.email}</p>
              </div>
            </div>

            {/* Data grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 font-mono block uppercase">Assigned Role</span>
                <div className="mt-1">{getRoleBadge(viewingUser.role)}</div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 font-mono block uppercase">Contact Phone</span>
                <span className="font-semibold text-slate-800 mt-1 block">
                  {viewingUser.phone || 'Not provided'}
                </span>
              </div>

              <div className="p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 font-mono block uppercase">Onboarded Date</span>
                <span className="font-mono text-slate-700 mt-1 block">{formatDate(viewingUser.createdAt)}</span>
              </div>

              <div className="p-3 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-400 font-mono block uppercase">Tenant Workspace</span>
                <span className="font-semibold text-indigo-600 mt-1 block">{currentTenant?.name}</span>
              </div>
            </div>

            {/* Granted Capabilities List */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Granted Role Capabilities
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {getRolePermissions(viewingUser.role).length} Permissions Active
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {getRolePermissions(viewingUser.role).map((perm) => (
                  <span
                    key={perm}
                    className="px-2 py-0.5 rounded text-[10px] font-mono bg-white text-slate-700 border border-slate-200"
                  >
                    {perm}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setViewModalOpen(false)}>
                Close Inspector
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

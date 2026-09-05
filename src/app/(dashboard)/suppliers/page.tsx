'use client';

import React, { useState, useMemo } from 'react';
import { useTenant } from '@/context/TenantContext';
import { SupplierService, PurchaseService, PaymentService, AccountService, calculateSupplierCurrentBalance } from '@/services/erp.service';
import { Supplier, PurchaseOrder, Payment, Account } from '@/types/erp';
import { useRealtimeCollection } from '@/hooks/useRealtimeCollection';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, Column } from '@/components/common/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, Building2, Mail, Phone, MapPin, CreditCard, AlertCircle } from 'lucide-react';
import { SupplierDetailModal } from '@/components/suppliers/SupplierDetailModal';
import { useToast } from '@/context/ToastContext';
import { generateNextSupplierCode } from '@/lib/sequenceGenerator';

export default function SuppliersPage() {
  const { currentTenant } = useTenant();
  const { showToast } = useToast();
  const tenantId = currentTenant?.id || 'tenant-apex-corp';

  const {
    items: suppliers,
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
  } = useRealtimeCollection<Supplier>((tenantId) => new SupplierService(tenantId), {
    sortBy: 'createdAt',
    sortDirection: 'desc',
  });

  const { allItems: purchases, updateItem: updatePurchase } = useRealtimeCollection<PurchaseOrder>((tenantId) => new PurchaseService(tenantId));
  const { allItems: payments, createItem: createPayment } = useRealtimeCollection<Payment>((tenantId) => new PaymentService(tenantId));
  const { allItems: accounts } = useRealtimeCollection<Account>((tenantId) => new AccountService(tenantId));

  const currencySymbol = currentTenant?.settings.currencySymbol || '$';
  const currencyCode = currentTenant?.settings.currency || 'USD';

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Detail Modal State
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Quick Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [payingSupplier, setPayingSupplier] = useState<Supplier | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'cash' | 'credit_card' | 'cheque'>('bank_transfer');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [taxNumber, setTaxNumber] = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState('30');
  const [creditLimit, setCreditLimit] = useState('50000');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('USA');
  const [notes, setNotes] = useState('');

  // Map suppliers with dynamically calculated transaction-derived balances
  const suppliersWithCalculatedBalances = useMemo(() => {
    return suppliers.map((s) => {
      const liveBalance = calculateSupplierCurrentBalance(s, purchases, payments);
      return {
        ...s,
        currentBalance: liveBalance,
      };
    });
  }, [suppliers, purchases, payments]);

  const openCreateModal = () => {
    setEditingSupplier(null);
    setName('');
    const nextCode = generateNextSupplierCode(suppliers.map((s) => s.code));
    setCode(nextCode);
    setCompanyName('');
    setEmail('');
    setPhone('');
    setTaxNumber('');
    setPaymentTermsDays('30');
    setCreditLimit('50000');
    setOpeningBalance('0');
    setStreet('');
    setCity('');
    setState('');
    setPostalCode('');
    setCountry('USA');
    setNotes('');
    setModalOpen(true);
  };

  const openEditModal = (sup: Supplier) => {
    setEditingSupplier(sup);
    setName(sup.name);
    setCode(sup.code);
    setCompanyName(sup.companyName);
    setEmail(sup.email || '');
    setPhone(sup.phone || '');
    setTaxNumber(sup.taxNumber || '');
    setPaymentTermsDays(String(sup.paymentTermsDays || 30));
    setCreditLimit(String(sup.creditLimit || 0));
    setOpeningBalance(String(sup.openingBalance || 0));
    setStreet(sup.address?.street || '');
    setCity(sup.address?.city || '');
    setState(sup.address?.state || '');
    setPostalCode(sup.address?.postalCode || '');
    setCountry(sup.address?.country || 'USA');
    setNotes(sup.notes || '');
    setModalOpen(true);
  };

  const openDetailModal = (sup: Supplier) => {
    setViewingSupplier(sup);
    setDetailModalOpen(true);
  };

  const openPaymentModal = (sup: Supplier) => {
    setPayingSupplier(sup);
    const balance = calculateSupplierCurrentBalance(sup, purchases, payments);
    setPaymentAmount(balance > 0 ? String(balance) : '');
    setPaymentReference(`ACH-${Math.floor(100000 + Math.random() * 900000)}`);
    setPaymentNotes('');
    const defaultAcc = accounts.find((a) => a.isDefault && a.status === 'active') || accounts.find((a) => a.status === 'active');
    setSelectedAccountId(defaultAcc?.id || '');
    setPaymentModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) return;

    setSubmitting(true);
    try {
      const parsedOpeningBalance = parseFloat(openingBalance) || 0;
      const parsedCreditLimit = parseFloat(creditLimit) || 0;

      const payload = {
        name,
        code,
        companyName: companyName || name,
        email: email || undefined,
        phone: phone || undefined,
        taxNumber: taxNumber || undefined,
        paymentTermsDays: parseInt(paymentTermsDays, 10) || 30,
        creditLimit: parsedCreditLimit,
        openingBalance: parsedOpeningBalance,
        currentBalance: parsedOpeningBalance,
        address: {
          street: street || undefined,
          city: city || undefined,
          state: state || undefined,
          postalCode: postalCode || undefined,
          country: country || 'USA',
        },
        notes: notes || undefined,
      };

      if (editingSupplier) {
        await updateItem(editingSupplier.id, payload);
        showToast(`Supplier "${name}" updated successfully`, 'success');
      } else {
        await createItem({
          ...payload,
          status: 'active',
        });
        showToast(`Supplier "${name}" registered successfully`, 'success');
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast('Error saving supplier', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Safe Deletion Guard
  const handleSafeDelete = async (id: string) => {
    const sup = suppliersWithCalculatedBalances.find((s) => s.id === id);
    if (!sup) return;

    if (sup.currentBalance !== 0) {
      showToast(
        `Cannot delete ${sup.name}: Supplier has an active payable liability of ${formatCurrency(sup.currentBalance, currencyCode, currencySymbol)}. Settle liability before deleting.`,
        'warning'
      );
      return;
    }

    const hasPurchases = purchases.some((p) => p.supplierId === id && !p.isDeleted);
    if (hasPurchases) {
      showToast(
        `Cannot delete ${sup.name}: Supplier is linked to purchase orders. Consider toggling status to Inactive instead.`,
        'warning'
      );
      return;
    }

    try {
      await softDeleteItem(id);
      showToast(`Supplier "${sup.name}" safely deleted`, 'info');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete supplier', 'error');
    }
  };

  // Process Quick Supplier Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingSupplier || !paymentAmount) return;

    const parsedAmount = parseFloat(paymentAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      showToast('Please specify a valid payment amount', 'error');
      return;
    }

    setSubmittingPayment(true);
    try {
      const activeAccounts = accounts.filter((a) => a.status === 'active' && !a.isDeleted);
      const targetAcc = activeAccounts.find((a) => a.id === selectedAccountId) ||
                        activeAccounts.find((a) => a.isDefault) ||
                        activeAccounts[0];

      await createPayment({
        paymentNumber: `PMT-${Math.floor(1000 + Math.random() * 9000)}`,
        partyType: 'supplier',
        partyId: payingSupplier.id,
        partyName: payingSupplier.name,
        type: 'payment',
        amount: parsedAmount,
        date: new Date().toISOString(),
        accountId: targetAcc?.id || 'acc-001',
        accountName: targetAcc?.accountName || 'Primary Operating Account',
        paymentMethod,
        reference: paymentReference || undefined,
        notes: paymentNotes || `Disbursement to ${payingSupplier.name}`,
        status: 'active',
      });

      // 1. Update Account balance in real-time
      if (targetAcc) {
        const accService = new AccountService(tenantId);
        await accService.update(targetAcc.id, {
          currentBalance: (targetAcc.currentBalance || 0) - parsedAmount,
        });
      }

      // 2. Auto-allocate across supplier's oldest unpaid purchase orders
      let remainingToAllocate = parsedAmount;
      const unpaidPOs = purchases
        .filter((p) => p.supplierId === payingSupplier.id && p.paymentStatus !== 'paid' && p.purchaseStatus !== 'draft' && p.purchaseStatus !== 'void' && !p.isDeleted)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      for (const po of unpaidPOs) {
        if (remainingToAllocate <= 0) break;
        const unpaidOnPO = po.balanceAmount > 0 ? po.balanceAmount : Math.max(0, po.totalAmount - (po.paidAmount || 0));
        const alloc = Math.min(remainingToAllocate, unpaidOnPO);
        const newPaid = (po.paidAmount || 0) + alloc;
        const newBalance = Math.max(0, po.totalAmount - newPaid);
        const newStatus = newPaid >= po.totalAmount ? 'paid' : 'partial';

        await updatePurchase(po.id, {
          paidAmount: newPaid,
          balanceAmount: newBalance,
          paymentStatus: newStatus,
        });
        remainingToAllocate -= alloc;
      }

      // 3. Update supplier's current balance
      await updateItem(payingSupplier.id, {
        currentBalance: Math.max(0, (payingSupplier.currentBalance || 0) - parsedAmount),
      });

      showToast(
        `Payment of ${formatCurrency(parsedAmount, currencyCode, currencySymbol)} disbursed. Supplier & accounts updated in real-time!`,
        'success'
      );
      setPaymentModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast('Failed to disburse payment', 'error');
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleSortChange = (field: string) => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  const columns: Column<Supplier>[] = [
    {
      key: 'name',
      header: 'Supplier / Vendor',
      sortable: true,
      render: (item) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 hover:text-indigo-600 cursor-pointer" onClick={() => openDetailModal(item)}>
              {item.name}
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
              {item.code}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">{item.companyName}</p>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Contact Info',
      render: (item) => (
        <div className="space-y-0.5 text-[11px]">
          {item.email && (
            <div className="flex items-center gap-1.5 text-slate-600">
              <Mail className="w-3 h-3 text-slate-400" />
              <span>{item.email}</span>
            </div>
          )}
          {item.phone && (
            <div className="flex items-center gap-1.5 text-slate-600">
              <Phone className="w-3 h-3 text-slate-400" />
              <span>{item.phone}</span>
            </div>
          )}
          {!item.email && !item.phone && <span className="text-slate-400">None</span>}
        </div>
      ),
    },
    {
      key: 'paymentTermsDays',
      header: 'Terms',
      sortable: true,
      align: 'center',
      render: (item) => (
        <span className="font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs">
          Net {item.paymentTermsDays || 30}d
        </span>
      ),
    },
    {
      key: 'openingBalance',
      header: 'Opening Bal',
      sortable: true,
      align: 'right',
      render: (item) => (
        <span className="font-mono text-slate-500 text-xs">
          {formatCurrency(item.openingBalance || 0, currencyCode, currencySymbol)}
        </span>
      ),
    },
    {
      key: 'currentBalance',
      header: 'Payable Balance',
      sortable: true,
      align: 'right',
      render: (item) => (
        <div className="text-right">
          <span
            className={`font-mono font-bold block ${
              item.currentBalance > 0 ? 'text-rose-600' : 'text-slate-700'
            }`}
          >
            {formatCurrency(item.currentBalance, currencyCode, currencySymbol)}
          </span>
          <span className="text-[10px] text-slate-400 font-sans block">Calculated from Ledger</span>
        </div>
      ),
    },
    {
      key: 'actions_pay',
      header: 'Quick Pay',
      align: 'center',
      render: (item) => (
        <button
          type="button"
          onClick={() => openPaymentModal(item)}
          className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors"
        >
          Pay
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        title="Supplier & Vendor Directory"
        subtitle={`Managing vendor accounts and payable liabilities for ${currentTenant?.name} (${currentTenant?.code})`}
        actions={
          <Button size="sm" onClick={openCreateModal}>
            <Plus className="w-4 h-4" />
            Add Supplier
          </Button>
        }
      />

      {/* Transaction-Derived Balance Policy Alert */}
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>
            <strong>Ledger-Derived Balance Rule Active:</strong> Supplier payable balances are calculated dynamically from opening balances, purchase orders, and payment disbursements. Manual balance editing is prohibited.
          </span>
        </div>
        <span className="text-indigo-600 font-mono font-semibold shrink-0 ml-2">Real-Time Sync</span>
      </div>

      <DataTable<Supplier>
        columns={columns}
        data={suppliersWithCalculatedBalances}
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
        onSortChange={handleSortChange}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        onView={openDetailModal}
        onEdit={openEditModal}
        onToggleStatus={toggleStatus}
        onDelete={handleSafeDelete}
        title="Suppliers Registry"
        description="Real-time multi-tenant vendor records and payables"
      />

      {/* Supplier Profile & Statement Detail Modal */}
      <SupplierDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        supplier={viewingSupplier}
        currencySymbol={currencySymbol}
        currencyCode={currencyCode}
        purchases={purchases}
        payments={payments}
        onAddPayment={openPaymentModal}
      />

      {/* Quick Disburse Payment Modal */}
      <Modal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title={`Disburse Payment: ${payingSupplier?.name}`}
        description="Record outgoing vendor disbursement. Balance will update immediately across ledger and dashboard."
        maxWidth="md"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <Input
            label={`Payment Amount (${currencySymbol})`}
            type="number"
            step="0.01"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            placeholder="0.00"
            required
          />

          <Select
            label="Disburse From Account"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            options={accounts
              .filter((a) => a.status === 'active' && !a.isDeleted)
              .map((a) => ({
                value: a.id,
                label: `${a.accountName} (${formatCurrency(a.currentBalance || 0, currencyCode, currencySymbol)})`,
              }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Payment Method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as any)}
              options={[
                { value: 'bank_transfer', label: 'Bank Transfer / Wire' },
                { value: 'cash', label: 'Cash Drawer' },
                { value: 'credit_card', label: 'Credit Card' },
                { value: 'cheque', label: 'Cheque' },
              ]}
            />
            <Input
              label="Transaction Reference #"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="e.g. ACH-902184"
            />
          </div>

          <Input
            label="Payment Notes / Memo"
            value={paymentNotes}
            onChange={(e) => setPaymentNotes(e.target.value)}
            placeholder="e.g. Settlement for invoice PO-2002..."
          />

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setPaymentModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={submittingPayment}>
              Confirm Disbursement
            </Button>
          </div>
        </form>
      </Modal>

      {/* Supplier Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingSupplier ? `Edit Supplier: ${editingSupplier.name}` : 'Register New Vendor / Supplier'}
        description="Configure vendor credentials, credit terms, and address. Opening balance cannot be manipulated after creation."
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Supplier / Contact Person Name"
              placeholder="e.g. Acme Industrial Supplies"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label="Supplier Code"
              placeholder="e.g. SUPP-101"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Company Legal Name"
              placeholder="e.g. Acme Global Ltd"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
            <Input
              label="Tax Registration Number / Tax ID"
              placeholder="e.g. US-901823746"
              value={taxNumber}
              onChange={(e) => setTaxNumber(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Contact Email"
              type="email"
              placeholder="sales@acme.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Phone Number"
              placeholder="+1 (555) 391-0294"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Payment Terms (Days)"
              type="number"
              value={paymentTermsDays}
              onChange={(e) => setPaymentTermsDays(e.target.value)}
              required
            />
            <Input
              label={`Credit Limit (${currencySymbol})`}
              type="number"
              step="100"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              required
            />
            <Input
              label={`Opening Balance (${currencySymbol})`}
              type="number"
              step="0.01"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              disabled={Boolean(editingSupplier)}
              required
            />
          </div>

          {/* Full Address */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 mb-2">Dispatch Address</label>
            <div className="space-y-2">
              <Input
                label="Street Address"
                placeholder="400 Industrial Parkway"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Input
                  label="City"
                  placeholder="Detroit"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
                <Input
                  label="State"
                  placeholder="MI"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                />
                <Input
                  label="Postal Code"
                  placeholder="48201"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                />
                <Input
                  label="Country"
                  placeholder="USA"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Input
            label="Internal Vendor Notes & Agreement"
            placeholder="e.g. Lead time, warranty policies, primary point of contact..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={submitting}>
              {editingSupplier ? 'Update Supplier' : 'Save Supplier'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

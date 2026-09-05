'use client';

import React, { useState, useMemo } from 'react';
import { useTenant } from '@/context/TenantContext';
import { CustomerService, SaleService, PaymentService, AccountService, calculateCustomerCurrentBalance } from '@/services/erp.service';
import { Customer, SaleInvoice, Payment, Account } from '@/types/erp';
import { useRealtimeCollection } from '@/hooks/useRealtimeCollection';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, Column } from '@/components/common/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, Users, Mail, Phone, MapPin, Building, CreditCard, AlertCircle } from 'lucide-react';
import { CustomerDetailModal } from '@/components/customers/CustomerDetailModal';
import { useToast } from '@/context/ToastContext';

export default function CustomersPage() {
  const { currentTenant } = useTenant();
  const { showToast } = useToast();
  const tenantId = currentTenant?.id || 'tenant-apex-corp';

  const {
    items: customers,
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
  } = useRealtimeCollection<Customer>((tenantId) => new CustomerService(tenantId), {
    sortBy: 'createdAt',
    sortDirection: 'desc',
  });

  const { allItems: sales, updateItem: updateSale } = useRealtimeCollection<SaleInvoice>((tenantId) => new SaleService(tenantId));
  const { allItems: payments, createItem: createPayment } = useRealtimeCollection<Payment>((tenantId) => new PaymentService(tenantId));
  const { allItems: accounts } = useRealtimeCollection<Account>((tenantId) => new AccountService(tenantId));

  const currencySymbol = currentTenant?.settings.currencySymbol || '$';
  const currencyCode = currentTenant?.settings.currency || 'USD';

  // Modal & Form State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Detail Modal State
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Quick Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [payingCustomer, setPayingCustomer] = useState<Customer | null>(null);
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
  const [creditLimit, setCreditLimit] = useState('10000');
  const [openingBalance, setOpeningBalance] = useState('0');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('USA');
  const [notes, setNotes] = useState('');

  // Map customers with dynamically calculated transaction-derived balances
  const customersWithCalculatedBalances = useMemo(() => {
    return customers.map((c) => {
      const liveBalance = calculateCustomerCurrentBalance(c, sales, payments);
      return {
        ...c,
        currentBalance: liveBalance,
      };
    });
  }, [customers, sales, payments]);

  const openCreateModal = () => {
    setEditingCustomer(null);
    setName('');
    setCode(`CUST-${Math.floor(100 + Math.random() * 900)}`);
    setCompanyName('');
    setEmail('');
    setPhone('');
    setTaxNumber('');
    setCreditLimit('10000');
    setOpeningBalance('0');
    setStreet('');
    setCity('');
    setState('');
    setPostalCode('');
    setCountry('USA');
    setNotes('');
    setModalOpen(true);
  };

  const openEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setName(cust.name);
    setCode(cust.code);
    setCompanyName(cust.companyName || '');
    setEmail(cust.email || '');
    setPhone(cust.phone || '');
    setTaxNumber(cust.taxNumber || '');
    setCreditLimit(String(cust.creditLimit || 0));
    setOpeningBalance(String(cust.openingBalance || 0));
    setStreet(cust.address?.street || '');
    setCity(cust.address?.city || '');
    setState(cust.address?.state || '');
    setPostalCode(cust.address?.postalCode || '');
    setCountry(cust.address?.country || 'USA');
    setNotes(cust.notes || '');
    setModalOpen(true);
  };

  const openDetailModal = (cust: Customer) => {
    setViewingCustomer(cust);
    setDetailModalOpen(true);
  };

  const openPaymentModal = (cust: Customer) => {
    setPayingCustomer(cust);
    const balance = calculateCustomerCurrentBalance(cust, sales, payments);
    setPaymentAmount(balance > 0 ? String(balance) : '');
    setPaymentReference(`WIRE-${Math.floor(100000 + Math.random() * 900000)}`);
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

      if (editingCustomer) {
        await updateItem(editingCustomer.id, {
          name,
          companyName: companyName || undefined,
          email: email || undefined,
          phone: phone || undefined,
          taxNumber: taxNumber || undefined,
          creditLimit: parsedCreditLimit,
          openingBalance: parsedOpeningBalance,
          address: {
            street,
            city,
            state,
            postalCode,
            country,
          },
          notes: notes || undefined,
        });
        showToast(`Customer "${name}" updated successfully`, 'success');
      } else {
        await createItem({
          name,
          code,
          companyName: companyName || undefined,
          email: email || undefined,
          phone: phone || undefined,
          taxNumber: taxNumber || undefined,
          creditLimit: parsedCreditLimit,
          openingBalance: parsedOpeningBalance,
          currentBalance: parsedOpeningBalance,
          status: 'active',
          address: {
            street,
            city,
            state,
            postalCode,
            country,
          },
          notes: notes || undefined,
        });
        showToast(`Customer "${name}" created successfully`, 'success');
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast('Failed to save customer', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSafeDelete = async (id: string) => {
    const cust = customers.find((c) => c.id === id);
    if (!cust) return;

    // Invariant: cannot delete customer with active sales
    const hasSales = sales.some((s) => s.customerId === id && !s.isDeleted);
    if (hasSales) {
      showToast(
        `Cannot delete ${cust.name}: Customer is linked to existing invoice records. Consider setting status to Inactive instead.`,
        'warning'
      );
      return;
    }

    try {
      await softDeleteItem(id);
      showToast(`Customer "${cust.name}" safely deleted`, 'info');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete customer', 'error');
    }
  };

  // Process Quick Payment Receipt
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCustomer || !paymentAmount) return;

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
        paymentNumber: `RCPT-${Math.floor(1000 + Math.random() * 9000)}`,
        partyType: 'customer',
        partyId: payingCustomer.id,
        partyName: payingCustomer.name,
        type: 'receipt',
        amount: parsedAmount,
        date: new Date().toISOString(),
        accountId: targetAcc?.id || 'acc-001',
        accountName: targetAcc?.accountName || 'Primary Operating Account',
        paymentMethod,
        reference: paymentReference || undefined,
        notes: paymentNotes || `Receipt from ${payingCustomer.name}`,
        status: 'active',
      });

      // 1. Update Account balance in real-time
      if (targetAcc) {
        const accService = new AccountService(tenantId);
        await accService.update(targetAcc.id, {
          currentBalance: (targetAcc.currentBalance || 0) + parsedAmount,
        });
      }

      // 2. Auto-allocate payment across customer's oldest unpaid invoices
      let remainingToAllocate = parsedAmount;
      const unpaidInvoices = sales
        .filter((s) => s.customerId === payingCustomer.id && s.paymentStatus !== 'paid' && s.saleStatus !== 'draft' && s.saleStatus !== 'void' && !s.isDeleted)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      for (const inv of unpaidInvoices) {
        if (remainingToAllocate <= 0) break;
        const unpaidOnInv = inv.balanceAmount > 0 ? inv.balanceAmount : Math.max(0, inv.totalAmount - (inv.paidAmount || 0));
        const alloc = Math.min(remainingToAllocate, unpaidOnInv);
        const newPaid = (inv.paidAmount || 0) + alloc;
        const newBalance = Math.max(0, inv.totalAmount - newPaid);
        const newStatus = newPaid >= inv.totalAmount ? 'paid' : 'partial';

        await updateSale(inv.id, {
          paidAmount: newPaid,
          balanceAmount: newBalance,
          paymentStatus: newStatus,
        });
        remainingToAllocate -= alloc;
      }

      // 3. Update customer's current balance
      await updateItem(payingCustomer.id, {
        currentBalance: Math.max(0, (payingCustomer.currentBalance || 0) - parsedAmount),
      });

      showToast(
        `Receipt of ${formatCurrency(parsedAmount, currencyCode, currencySymbol)} recorded. Customer & accounts updated in real-time!`,
        'success'
      );
      setPaymentModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast('Failed to record receipt', 'error');
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

  const columns: Column<Customer>[] = [
    {
      key: 'name',
      header: 'Customer Details',
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
          {item.companyName && item.companyName !== item.name && (
            <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
              <Building className="w-3 h-3 text-slate-400" />
              {item.companyName}
            </p>
          )}
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
      key: 'creditLimit',
      header: 'Credit Limit',
      sortable: true,
      align: 'right',
      render: (item) => (
        <span className="font-mono text-slate-700">
          {formatCurrency(item.creditLimit || 0, currencyCode, currencySymbol)}
        </span>
      ),
    },
    {
      key: 'currentBalance',
      header: 'Outstanding Balance',
      sortable: true,
      align: 'right',
      render: (item) => (
        <div className="text-right">
          <span
            className={`font-mono font-bold block ${
              item.currentBalance > 0 ? 'text-amber-600' : 'text-slate-700'
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
          className="px-2.5 py-1 text-[11px] font-semibold rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
        >
          Receive
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        title="Customer Master Accounts"
        subtitle={`Managing customer records and ledger balances for ${currentTenant?.name} (${currentTenant?.code})`}
        actions={
          <Button size="sm" onClick={openCreateModal}>
            <Plus className="w-4 h-4" />
            Add Customer
          </Button>
        }
      />

      {/* Transaction-Derived Balance Policy Alert */}
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>
            <strong>Ledger-Derived Balance Rule Active:</strong> Customer balances are calculated dynamically from opening balances, invoices, and payment receipts. Manual balance spoofing is prohibited.
          </span>
        </div>
        <span className="text-indigo-600 font-mono font-semibold shrink-0 ml-2">Real-Time Sync</span>
      </div>

      <DataTable<Customer>
        columns={columns}
        data={customersWithCalculatedBalances}
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
        title="Customers Directory"
        description="Real-time multi-tenant customer ledger and contact records"
      />

      {/* Profile & Running Ledger Detail Modal */}
      <CustomerDetailModal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        customer={viewingCustomer}
        currencySymbol={currencySymbol}
        currencyCode={currencyCode}
        sales={sales}
        payments={payments}
        onAddPayment={openPaymentModal}
      />

      {/* Quick Receive Payment Modal */}
      <Modal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title={`Receive Payment: ${payingCustomer?.name}`}
        description="Record incoming customer receipt. Balance will update immediately across ledger and dashboard."
        maxWidth="md"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <Input
            label={`Payment Receipt Amount (${currencySymbol})`}
            type="number"
            step="0.01"
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            placeholder="0.00"
            required
          />

          <Select
            label="Deposit Into Account"
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
              placeholder="e.g. WIRE-892104"
            />
          </div>

          <Input
            label="Receipt Notes / Memo"
            value={paymentNotes}
            onChange={(e) => setPaymentNotes(e.target.value)}
            placeholder="e.g. Partial settlement for invoice..."
          />

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setPaymentModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={submittingPayment}>
              Confirm Receipt
            </Button>
          </div>
        </form>
      </Modal>

      {/* Customer Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCustomer ? `Edit Customer: ${editingCustomer.name}` : 'Create New Customer Master'}
        description="Configure account parameters, credit limit, and address. Opening balance cannot be manipulated after creation."
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Customer Full Name"
              placeholder="e.g. Johnathan Miller"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              label="Customer Code / ID"
              placeholder="e.g. CUST-101"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Company Legal Name"
              placeholder="e.g. Vanguard Aerospace Inc."
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
            <Input
              label="Tax Registration Number"
              placeholder="e.g. TX-9928192"
              value={taxNumber}
              onChange={(e) => setTaxNumber(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Email Address"
              type="email"
              placeholder="accounting@client.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Phone Number"
              placeholder="+1 (555) 019-2831"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              disabled={Boolean(editingCustomer)}
              required
            />
          </div>

          {/* Full Address */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 mb-2">Invoicing Address</label>
            <div className="space-y-2">
              <Input
                label="Street Address"
                placeholder="100 Aviation Way"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Input
                  label="City"
                  placeholder="Austin"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
                <Input
                  label="State"
                  placeholder="TX"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                />
                <Input
                  label="Postal Code"
                  placeholder="78701"
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
            label="Internal Account Notes & Terms"
            placeholder="e.g. Special billing terms, preferred shipping destination..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={submitting}>
              {editingCustomer ? 'Update Customer' : 'Save Customer Record'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

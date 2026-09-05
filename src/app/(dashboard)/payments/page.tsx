'use client';

import React, { useState, useMemo } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  PaymentService,
  CustomerService,
  SupplierService,
  AccountService,
  SaleService,
  PurchaseService,
  AuditLogService,
} from '@/services/erp.service';
import { Payment, Customer, Supplier, Account, PaymentPartyType, PaymentTransactionType, SaleInvoice, PurchaseOrder } from '@/types/erp';
import { useRealtimeCollection } from '@/hooks/useRealtimeCollection';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, Column } from '@/components/common/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { formatCurrency, formatDate } from '@/lib/utils';
import { printPaymentReceipt } from '@/lib/pdfPrint';
import { generateNextPaymentNumber } from '@/lib/sequenceGenerator';
import {
  Plus,
  CreditCard,
  ArrowDownLeft,
  ArrowUpRight,
  DollarSign,
  Wallet,
  Building2,
  Trash2,
  User,
  Truck,
  Printer,
  FileText,
  CheckCircle2,
  ArrowRightLeft,
  Eye,
  Search,
} from 'lucide-react';

export default function PaymentsPage() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { showToast } = useToast();

  const tenantId = currentTenant?.id || 'tenant-apex-corp';
  const currencySymbol = currentTenant?.settings.currencySymbol || '$';
  const currencyCode = currentTenant?.settings.currency || 'USD';

  // Real-time payments collection
  const {
    items: payments,
    allItems: allPayments,
    totalCount,
    loading,
    page,
    pageSize,
    totalPages,
    setPage,
    setPageSize,
    searchQuery,
    setSearchQuery,
    sortBy,
    sortDirection,
    setSortBy,
    setSortDirection,
    createItem,
    softDeleteItem,
  } = useRealtimeCollection<Payment>((tId) => new PaymentService(tId), {
    sortBy: 'date',
    sortDirection: 'desc',
  });

  // Supporting real-time collections
  const { allItems: customers } = useRealtimeCollection<Customer>((tId) => new CustomerService(tId));
  const { allItems: suppliers } = useRealtimeCollection<Supplier>((tId) => new SupplierService(tId));
  const { allItems: accounts } = useRealtimeCollection<Account>((tId) => new AccountService(tId));
  const { allItems: sales, updateItem: updateSale } = useRealtimeCollection<SaleInvoice>((tId) => new SaleService(tId));
  const { allItems: purchases, updateItem: updatePurchase } = useRealtimeCollection<PurchaseOrder>((tId) => new PurchaseService(tId));

  const accountService = useMemo(() => new AccountService(tenantId), [tenantId]);
  const auditLogService = useMemo(() => new AuditLogService(tenantId), [tenantId]);

  // Modal & Filter States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewPayment, setViewPayment] = useState<Payment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [partyTypeFilter, setPartyTypeFilter] = useState<'all' | 'customer' | 'supplier' | 'internal_transfer'>('all');

  // Form State
  const [partyType, setPartyType] = useState<PaymentPartyType>('customer');
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [selectedDocId, setSelectedDocId] = useState(''); // invoiceId or purchaseOrderId
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'credit_card' | 'cheque'>('bank_transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [partySearchQuery, setPartySearchQuery] = useState('');

  const filteredParties = useMemo(() => {
    const q = partySearchQuery.trim().toLowerCase();
    if (partyType === 'customer') {
      const activeCusts = customers.filter((c) => !c.isDeleted && c.status === 'active');
      if (!q) return activeCusts;
      return activeCusts.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.code?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q)
      );
    } else {
      const activeSupps = suppliers.filter((s) => !s.isDeleted && s.status === 'active');
      if (!q) return activeSupps;
      return activeSupps.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.code?.toLowerCase().includes(q) ||
          s.phone?.toLowerCase().includes(q)
      );
    }
  }, [partyType, customers, suppliers, partySearchQuery]);

  // Filtered Payments
  const filteredPayments = useMemo(() => {
    if (partyTypeFilter === 'all') return payments;
    return payments.filter((p) => p.partyType === partyTypeFilter);
  }, [payments, partyTypeFilter]);

  // High-level KPI Computations
  const stats = useMemo(() => {
    const receipts = allPayments
      .filter((p) => p.type === 'receipt')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    const disbursements = allPayments
      .filter((p) => p.type === 'payment')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    const transfers = allPayments
      .filter((p) => p.type === 'transfer')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    const netCashflow = receipts - disbursements;

    return {
      receipts,
      disbursements,
      transfers,
      netCashflow,
      count: allPayments.length,
    };
  }, [allPayments]);

  // Eligible unpaid invoices for selected customer
  const eligibleInvoices = useMemo(() => {
    if (partyType !== 'customer' || !selectedPartyId) return [];
    return sales.filter(
      (s) =>
        s.customerId === selectedPartyId &&
        s.paymentStatus !== 'paid' &&
        s.saleStatus !== 'draft' &&
        s.saleStatus !== 'void' &&
        !s.isDeleted
    );
  }, [partyType, selectedPartyId, sales]);

  // Eligible unpaid purchase orders for selected supplier
  const eligiblePOs = useMemo(() => {
    if (partyType !== 'supplier' || !selectedPartyId) return [];
    return purchases.filter(
      (p) =>
        p.supplierId === selectedPartyId &&
        p.paymentStatus !== 'paid' &&
        p.purchaseStatus !== 'draft' &&
        p.purchaseStatus !== 'void' &&
        !p.isDeleted
    );
  }, [partyType, selectedPartyId, purchases]);

  const handleOpenCreateModal = () => {
    setPartyType('customer');
    setSelectedPartyId(customers[0]?.id || '');
    setSelectedDocId('');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setSelectedAccountId(accounts[0]?.id || '');
    setPaymentMethod('bank_transfer');
    setReference('');
    setNotes('');
    setCreateModalOpen(true);
  };

  const handleSelectDoc = (docId: string) => {
    setSelectedDocId(docId);
    if (partyType === 'customer') {
      const inv = eligibleInvoices.find((i) => i.id === docId);
      if (inv) {
        setAmount(inv.balanceAmount.toString());
        setReference(inv.invoiceNumber);
        setNotes(`Payment settlement for Invoice #${inv.invoiceNumber}`);
      }
    } else if (partyType === 'supplier') {
      const po = eligiblePOs.find((p) => p.id === docId);
      if (po) {
        setAmount(po.balanceAmount.toString());
        setReference(po.poNumber);
        setNotes(`Disbursement for Purchase Order #${po.poNumber}`);
      }
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      showToast('Please enter a valid payment amount.', 'error');
      return;
    }

    let partyName = '';
    if (partyType === 'customer') {
      const c = customers.find((cust) => cust.id === selectedPartyId);
      if (!c) {
        showToast('Please select a customer.', 'error');
        return;
      }
      partyName = c.name;
    } else {
      const s = suppliers.find((supp) => supp.id === selectedPartyId);
      if (!s) {
        showToast('Please select a supplier.', 'error');
        return;
      }
      partyName = s.name;
    }

    const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
    if (!selectedAccount) {
      showToast('Please select a bank or cash account.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const isReceipt = partyType === 'customer';
      const txType: PaymentTransactionType = isReceipt ? 'receipt' : 'payment';
      const paymentNumber = generateNextPaymentNumber(
        payments.map((p) => p.paymentNumber),
        txType,
        1001
      );

      let linkedInvNumber = '';
      let linkedPONumber = '';

      // 1. If customer payment
      if (partyType === 'customer') {
        if (selectedDocId) {
          const inv = sales.find((s) => s.id === selectedDocId);
          if (inv) {
            linkedInvNumber = inv.invoiceNumber;
            const newPaid = (inv.paidAmount || 0) + parsedAmount;
            const newBalance = Math.max(0, inv.totalAmount - newPaid);
            const newStatus = newPaid >= inv.totalAmount ? 'paid' : 'partial';

            await updateSale(inv.id, {
              paidAmount: newPaid,
              balanceAmount: newBalance,
              paymentStatus: newStatus,
            });
          }
        } else {
          // Auto-allocate across oldest unpaid invoices
          let remainingToAllocate = parsedAmount;
          const unpaidInvoices = sales
            .filter((s) => s.customerId === selectedPartyId && s.paymentStatus !== 'paid' && s.saleStatus !== 'draft' && s.saleStatus !== 'void' && !s.isDeleted)
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
        }

        // Real-time update to Customer balance
        const cust = customers.find((c) => c.id === selectedPartyId);
        if (cust) {
          const custSvc = new CustomerService(tenantId);
          await custSvc.update(cust.id, {
            currentBalance: Math.max(0, (cust.currentBalance || 0) - parsedAmount),
          });
        }
      }

      // 2. If supplier disbursement
      if (partyType === 'supplier') {
        if (selectedDocId) {
          const po = purchases.find((p) => p.id === selectedDocId);
          if (po) {
            linkedPONumber = po.poNumber;
            const newPaid = (po.paidAmount || 0) + parsedAmount;
            const newBalance = Math.max(0, po.totalAmount - newPaid);
            const newStatus = newPaid >= po.totalAmount ? 'paid' : 'partial';

            await updatePurchase(po.id, {
              paidAmount: newPaid,
              balanceAmount: newBalance,
              paymentStatus: newStatus,
            });
          }
        } else {
          // Auto-allocate across oldest unpaid purchase orders
          let remainingToAllocate = parsedAmount;
          const unpaidPOs = purchases
            .filter((p) => p.supplierId === selectedPartyId && p.paymentStatus !== 'paid' && p.purchaseStatus !== 'draft' && p.purchaseStatus !== 'void' && !p.isDeleted)
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
        }

        // Real-time update to Supplier balance
        const supp = suppliers.find((s) => s.id === selectedPartyId);
        if (supp) {
          const suppSvc = new SupplierService(tenantId);
          await suppSvc.update(supp.id, {
            currentBalance: Math.max(0, (supp.currentBalance || 0) - parsedAmount),
          });
        }
      }

      // 3. Create Payment Record
      const newPay = await createItem({
        paymentNumber,
        partyType,
        partyId: selectedPartyId,
        partyName,
        type: txType,
        amount: parsedAmount,
        date,
        accountId: selectedAccount.id,
        accountName: selectedAccount.accountName,
        paymentMethod,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        invoiceId: selectedDocId && partyType === 'customer' ? selectedDocId : undefined,
        invoiceNumber: linkedInvNumber || undefined,
        purchaseOrderId: selectedDocId && partyType === 'supplier' ? selectedDocId : undefined,
        purchaseOrderNumber: linkedPONumber || undefined,
        status: 'active',
      });

      // 4. Adjust Account Balance (Receipts add, disbursements subtract)
      const balanceDelta = isReceipt ? parsedAmount : -parsedAmount;
      await accountService.update(selectedAccount.id, {
        currentBalance: (selectedAccount.currentBalance || 0) + balanceDelta,
      });

      // 5. Audit Log
      await auditLogService.create({
        action: 'CREATE',
        module: 'Payments',
        entityId: paymentNumber,
        entityName: partyName,
        description: isReceipt
          ? `Received ${formatCurrency(parsedAmount, currencyCode, currencySymbol)} from ${partyName}`
          : `Disbursed ${formatCurrency(parsedAmount, currencyCode, currencySymbol)} to ${partyName}`,
        userId: user?.uid || 'system',
        userName: user?.displayName || 'Administrator',
        userEmail: user?.email || 'admin@erp.com',
        timestamp: new Date().toISOString(),
      });

      showToast(
        `${isReceipt ? 'Receipt' : 'Payment'} ${paymentNumber} recorded! Account and ledger updated in real-time.`,
        'success'
      );
      setCreateModalOpen(false);
      setViewPayment(newPay);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record payment';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Columns for DataTable
  const columns: Column<Payment>[] = [
    {
      header: 'Payment #',
      accessor: 'paymentNumber',
      sortable: true,
      cell: (pay) => (
        <button
          onClick={() => setViewPayment(pay)}
          className="font-mono font-bold text-slate-900 hover:text-indigo-600 flex items-center gap-1.5"
        >
          <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
          {pay.paymentNumber}
        </button>
      ),
    },
    {
      header: 'Date',
      accessor: 'date',
      sortable: true,
      cell: (pay) => formatDate(pay.date),
    },
    {
      header: 'Classification',
      accessor: 'partyType',
      cell: (pay) => {
        if (pay.partyType === 'internal_transfer') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <ArrowRightLeft className="w-3 h-3" /> Fund Transfer
            </span>
          );
        }
        return (
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              pay.partyType === 'customer'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'bg-purple-50 text-purple-700 border border-purple-200'
            }`}
          >
            {pay.partyType === 'customer' ? <User className="w-3 h-3" /> : <Truck className="w-3 h-3" />}
            {pay.partyType === 'customer' ? 'Customer' : 'Supplier'}
          </span>
        );
      },
    },
    {
      header: 'Party Name',
      accessor: 'partyName',
      sortable: true,
      cell: (pay) => (
        <div>
          <span className="font-medium text-slate-900">{pay.partyName}</span>
          {pay.invoiceNumber && (
            <span className="block text-[10px] text-slate-400 font-mono">Invoice #{pay.invoiceNumber}</span>
          )}
          {pay.purchaseOrderNumber && (
            <span className="block text-[10px] text-slate-400 font-mono">PO #{pay.purchaseOrderNumber}</span>
          )}
        </div>
      ),
    },
    {
      header: 'Flow & Amount',
      accessor: 'amount',
      sortable: true,
      cell: (pay) => {
        if (pay.partyType === 'internal_transfer') {
          return (
            <span className="text-indigo-700 flex items-center gap-1 font-mono font-bold">
              <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
              {formatCurrency(pay.amount, currencyCode, currencySymbol)}
            </span>
          );
        }
        const isReceipt = pay.type === 'receipt';
        return (
          <div className="flex items-center gap-1.5 font-mono font-bold">
            {isReceipt ? (
              <span className="text-emerald-700 flex items-center gap-1">
                <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                +{formatCurrency(pay.amount, currencyCode, currencySymbol)}
              </span>
            ) : (
              <span className="text-rose-600 flex items-center gap-1">
                <ArrowUpRight className="w-4 h-4 text-rose-600" />
                -{formatCurrency(pay.amount, currencyCode, currencySymbol)}
              </span>
            )}
          </div>
        );
      },
    },
    {
      header: 'Account & Method',
      cell: (pay) => (
        <div className="text-xs">
          <div className="font-medium text-slate-800">{pay.accountName}</div>
          <div className="text-[10px] text-slate-500 capitalize">{pay.paymentMethod.replace('_', ' ')}</div>
        </div>
      ),
    },
    {
      header: 'Reference',
      accessor: 'reference',
      cell: (pay) => (
        <span className="text-xs font-mono text-slate-500">{pay.reference || '—'}</span>
      ),
    },
    {
      header: 'Actions',
      cell: (pay) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setViewPayment(pay)}
            title="View Payment"
          >
            <Eye className="w-4 h-4 text-slate-600" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => printPaymentReceipt(pay, currentTenant)}
            title="Print Voucher / Receipt"
          >
            <Printer className="w-4 h-4 text-indigo-600" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm(`Are you sure you want to delete payment record ${pay.paymentNumber}?`)) {
                softDeleteItem(pay.id);
                showToast(`Payment ${pay.paymentNumber} removed.`, 'info');
              }
            }}
            title="Delete Payment"
          >
            <Trash2 className="w-4 h-4 text-rose-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Payments & Cash Flow"
        description="Direct customer collections, supplier disbursements, invoice allocations, and treasury management."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Payments' },
        ]}
        actions={
          <Button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Record Payment
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Customer Collections
            </span>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <ArrowDownLeft className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2 font-mono">
            {formatCurrency(stats.receipts, currencyCode, currencySymbol)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Inward cash collections</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Supplier Disbursements
            </span>
            <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-600 mt-2 font-mono">
            {formatCurrency(stats.disbursements, currencyCode, currencySymbol)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Outward supplier disbursements</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Net Cash Flow
            </span>
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div
            className={`text-2xl font-bold mt-2 font-mono ${
              stats.netCashflow >= 0 ? 'text-indigo-700' : 'text-rose-600'
            }`}
          >
            {formatCurrency(stats.netCashflow, currencyCode, currencySymbol)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Receipts minus Disbursements</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Vouchers
            </span>
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">{stats.count}</div>
          <div className="text-xs text-slate-500 mt-1">Processed transactions</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
        {[
          { id: 'all', label: 'All Transactions' },
          { id: 'customer', label: 'Customer Receipts' },
          { id: 'supplier', label: 'Supplier Payments' },
          { id: 'internal_transfer', label: 'Bank Transfers' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setPartyTypeFilter(tab.id as any)}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
              partyTypeFilter === tab.id
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* DataTable */}
      <DataTable<Payment>
        data={filteredPayments}
        columns={columns}
        loading={loading}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        totalCount={filteredPayments.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSortChange={(field: string) => setSortBy(field)}
      />

      {/* RECORD PAYMENT MODAL */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Record Payment / Receipt"
        description="Allocate incoming customer collections or outgoing supplier disbursements to specific invoices or accounts."
        maxWidth="lg"
      >
        <form onSubmit={handleCreatePayment} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Transaction Category *</label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer ${
                  partyType === 'customer'
                    ? 'border-emerald-600 bg-emerald-50/50'
                    : 'border-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="partyType"
                  checked={partyType === 'customer'}
                  onChange={() => {
                    setPartyType('customer');
                    setSelectedPartyId(customers[0]?.id || '');
                    setSelectedDocId('');
                  }}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Customer Receipt</span>
                  <span className="text-[11px] text-slate-500">Money received into our account (+)</span>
                </div>
              </label>

              <label
                className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer ${
                  partyType === 'supplier'
                    ? 'border-rose-600 bg-rose-50/50'
                    : 'border-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="partyType"
                  checked={partyType === 'supplier'}
                  onChange={() => {
                    setPartyType('supplier');
                    setSelectedPartyId(suppliers[0]?.id || '');
                    setSelectedDocId('');
                  }}
                  className="text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Supplier Disbursement</span>
                  <span className="text-[11px] text-slate-500">Money paid out from our account (-)</span>
                </div>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  {partyType === 'customer' ? 'Customer *' : 'Supplier *'}
                </label>
                {partySearchQuery && (
                  <button
                    type="button"
                    onClick={() => setPartySearchQuery('')}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder={`Search ${partyType === 'customer' ? 'customer' : 'supplier'} (Name, Code, Phone)...`}
                  value={partySearchQuery}
                  onChange={(e) => setPartySearchQuery(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
              </div>
              <Select
                value={selectedPartyId}
                onChange={(e) => {
                  setSelectedPartyId(e.target.value);
                  setSelectedDocId('');
                }}
                required
                options={[
                  { label: `-- Choose ${partyType === 'customer' ? 'Customer' : 'Supplier'} (${filteredParties.length}) --`, value: '' },
                  ...filteredParties.map((p) => ({
                    label: `${p.name} ${p.code ? `(${p.code})` : ''} ${p.phone ? `• ${p.phone}` : ''}`,
                    value: p.id,
                  })),
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Allocate to Specific Invoice / PO (Optional)
              </label>
              <Select
                value={selectedDocId}
                onChange={(e) => handleSelectDoc(e.target.value)}
                options={[
                  { label: '-- General On-Account Settlement --', value: '' },
                  ...(partyType === 'customer'
                    ? eligibleInvoices.map((i) => ({
                        label: `${i.invoiceNumber} — Balance: ${formatCurrency(i.balanceAmount, currencyCode, currencySymbol)}`,
                        value: i.id,
                      }))
                    : eligiblePOs.map((p) => ({
                        label: `${p.poNumber} — Due: ${formatCurrency(p.balanceAmount, currencyCode, currencySymbol)}`,
                        value: p.id,
                      }))),
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Amount ({currencySymbol}) *
              </label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Date *
              </label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bank / Cash Account *
              </label>
              <Select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                required
                options={accounts.map((a) => ({
                  label: `${a.accountName} (${formatCurrency(a.currentBalance, currencyCode, currencySymbol)})`,
                  value: a.id,
                }))}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Method *
              </label>
              <Select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                required
                options={[
                  { label: 'Bank Transfer', value: 'bank_transfer' },
                  { label: 'Cash', value: 'cash' },
                  { label: 'Credit Card', value: 'credit_card' },
                  { label: 'Cheque', value: 'cheque' },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Cheque / Reference Number
              </label>
              <Input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. CHQ-99021 or WIRE-4401"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Memo / Notes
              </label>
              <Input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Monthly balance settlement"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className={`text-white font-bold ${
                partyType === 'customer'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {submitting ? 'Processing...' : partyType === 'customer' ? 'Receive Payment' : 'Disburse Payment'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* VIEW PAYMENT / VOUCHER MODAL */}
      {viewPayment && (
        <Modal
          isOpen={Boolean(viewPayment)}
          onClose={() => setViewPayment(null)}
          title={`Voucher ${viewPayment.paymentNumber}`}
          description="Remittance details, treasury allocation, and printable voucher"
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-bold uppercase">Party</span>
                <span className="text-sm font-bold text-slate-900">{viewPayment.partyName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-bold uppercase">Amount</span>
                <span className="text-xl font-bold font-mono text-indigo-700">
                  {formatCurrency(viewPayment.amount, currencyCode, currencySymbol)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-bold uppercase">Account</span>
                <span className="text-xs font-semibold text-slate-800">{viewPayment.accountName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-bold uppercase">Method</span>
                <span className="text-xs capitalize text-slate-700">{viewPayment.paymentMethod.replace('_', ' ')}</span>
              </div>
              {viewPayment.invoiceNumber && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-bold uppercase">Settled Invoice</span>
                  <span className="text-xs font-mono font-bold text-slate-800">#{viewPayment.invoiceNumber}</span>
                </div>
              )}
              {viewPayment.reference && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-bold uppercase">Reference</span>
                  <span className="text-xs font-mono text-slate-600">{viewPayment.reference}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => printPaymentReceipt(viewPayment, currentTenant)}
                className="flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4 text-indigo-600" /> Print Official Voucher
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewPayment(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

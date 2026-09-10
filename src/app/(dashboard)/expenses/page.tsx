'use client';

import React, { useState, useMemo } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  ExpenseService,
  AccountService,
  AuditLogService,
  CategoryService,
  PaymentService,
  AccountingAutomationService,
} from '@/services/erp.service';
import { Expense, Account, Category, ExpenseStatus } from '@/types/erp';
import { useRealtimeCollection } from '@/hooks/useRealtimeCollection';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, Column } from '@/components/common/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { formatCurrency, formatDate } from '@/lib/utils';
import { printExpenseVoucher } from '@/lib/pdfPrint';
import { generateNextExpenseNumber } from '@/lib/sequenceGenerator';
import {
  Plus,
  Receipt,
  DollarSign,
  Calendar,
  Building2,
  Trash2,
  Tag,
  CreditCard,
  Printer,
  Eye,
  FileText,
  Ban,
  CheckCircle2,
  Clock,
  Edit3,
  Filter,
  Settings2,
  ShieldAlert,
  Search,
  AlertCircle,
} from 'lucide-react';

export default function ExpensesPage() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { showToast } = useToast();

  const tenantId = currentTenant?.id || 'tenant-apex-corp';
  const currencySymbol = currentTenant?.settings.currencySymbol || '$';
  const currencyCode = currentTenant?.settings.currency || 'USD';

  // Real-time expenses collection
  const {
    items: expenses,
    allItems: allExpenses,
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
    updateItem,
    softDeleteItem,
  } = useRealtimeCollection<Expense>((tId) => new ExpenseService(tId), {
    sortBy: 'date',
    sortDirection: 'desc',
  });

  // Supporting real-time collections
  const { allItems: accounts } = useRealtimeCollection<Account>((tId) => new AccountService(tId));
  const {
    allItems: categories,
    createItem: createCategory,
    updateItem: updateCategory,
  } = useRealtimeCollection<Category>((tId) => new CategoryService(tId));

  const accountService = useMemo(() => new AccountService(tenantId), [tenantId]);
  const paymentService = useMemo(() => new PaymentService(tenantId), [tenantId]);
  const auditLogService = useMemo(() => new AuditLogService(tenantId), [tenantId]);

  // Active Categories for expense creation/editing
  const activeCategories = useMemo(() => {
    return categories.filter((c) => c.status !== 'inactive');
  }, [categories]);

  // Lifecycle Tabs & Filters
  const [statusTab, setStatusTab] = useState<'all' | 'posted' | 'draft' | 'void'>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modals State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [viewExpense, setViewExpense] = useState<Expense | null>(null);
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [expenseToVoid, setExpenseToVoid] = useState<Expense | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatCode, setNewCatCode] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form inputs
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [taxAmount, setTaxAmount] = useState('0');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'credit_card' | 'cheque'>('cash');
  const [vendor, setVendor] = useState('');
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  // Reset Create/Edit Form
  const resetForm = () => {
    setEditingExpense(null);
    setCategory(activeCategories[0]?.name || 'General Overhead');
    setDate(new Date().toISOString().split('T')[0]);
    setAmount('');
    setTaxAmount('0');
    setSelectedAccountId(accounts[0]?.id || '');
    setPaymentMethod('cash');
    setVendor('');
    setDescription('');
    setReference('');
    setNotes('');
  };

  const handleOpenCreateModal = () => {
    resetForm();
    if (activeCategories.length > 0) {
      setCategory(activeCategories[0].name);
    }
    if (accounts.length > 0) {
      setSelectedAccountId(accounts[0].id);
    }
    setCreateModalOpen(true);
  };

  const handleOpenEditDraftModal = (exp: Expense) => {
    setEditingExpense(exp);
    setCategory(exp.category);
    setDate(exp.date);
    setAmount(exp.amount.toString());
    setTaxAmount((exp.taxAmount || 0).toString());
    setSelectedAccountId(exp.accountId);
    setPaymentMethod(exp.paymentMethod || 'cash');
    setVendor(exp.vendor || '');
    setDescription(exp.description || '');
    setReference(exp.reference || '');
    setNotes(exp.notes || '');
    setCreateModalOpen(true);
  };

  // Submit Expense (Either as Draft or Confirmed Posted)
  const handleSubmitExpense = async (asDraft: boolean) => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      showToast('Please enter a valid expense amount greater than 0.', 'error');
      return;
    }

    const parsedTax = parseFloat(taxAmount) || 0;
    const total = parsedAmount + parsedTax;

    const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
    if (!selectedAccount) {
      showToast('Please select an active bank or cash account for disbursement.', 'error');
      return;
    }

    if (!category.trim()) {
      showToast('Please select or specify an expense category.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const effectiveStatus: ExpenseStatus = asDraft ? 'draft' : 'posted';
      const expenseNumber = editingExpense
        ? editingExpense.expenseNumber
        : generateNextExpenseNumber(expenses.map((e) => e.expenseNumber));

      const payload: Partial<Expense> = {
        expenseNumber,
        category,
        date,
        amount: parsedAmount,
        taxAmount: parsedTax,
        totalAmount: total,
        accountId: selectedAccount.id,
        accountName: selectedAccount.accountName,
        paymentMethod,
        vendor: vendor.trim() || undefined,
        description: description.trim() || `Operating Expense: ${category}`,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        expenseStatus: effectiveStatus,
        status: 'active',
      };

      if (editingExpense) {
        await updateItem(editingExpense.id, payload);
      } else {
        await createItem(payload as any);
      }

      // If Posted: Decrement Account Balance, Record Payment Disbursement, and create audit log
      if (!asDraft) {
        await accountService.update(selectedAccount.id, {
          currentBalance: (selectedAccount.currentBalance || 0) - total,
        });

        // Record Disbursement in Payment Register for real-time treasury sync
        const payNum = `PAY-EXP-${expenseNumber}`;
        await paymentService.create({
          paymentNumber: payNum,
          partyType: 'direct_withdrawal',
          partyId: selectedAccount.id,
          partyName: vendor ? `${category} (${vendor})` : category,
          type: 'payment',
          amount: total,
          date: date || new Date().toISOString().split('T')[0],
          accountId: selectedAccount.id,
          accountName: selectedAccount.accountName,
          paymentMethod: paymentMethod,
          reference: expenseNumber,
          notes: description || `Operating Expense: ${category}`,
          status: 'active',
        });

        // Automatic Double-Entry Journal Entry
        try {
          const accountingAutomation = new AccountingAutomationService(tenantId);
          await accountingAutomation.postExpense(
            {
              ...payload,
              id: editingExpense ? editingExpense.id : expenseNumber,
            } as Expense,
            accounts,
            user?.uid || 'system'
          );
        } catch (jeErr) {
          console.warn('Double-entry expense auto-posting note:', jeErr);
        }

        await auditLogService.create({
          action: editingExpense ? 'UPDATE' : 'CREATE',
          module: 'Expenses',
          entityId: expenseNumber,
          entityName: category,
          description: `Posted Expense #${expenseNumber} (${category}) for ${formatCurrency(total, currencyCode, currencySymbol)} from ${selectedAccount.accountName}`,
          userId: user?.uid || 'system',
          userName: user?.displayName || 'Administrator',
          userEmail: user?.email || 'admin@erp.com',
          timestamp: new Date().toISOString(),
        });

        showToast(
          `Expense ${expenseNumber} posted! Account "${selectedAccount.accountName}" debited in real-time.`,
          'success'
        );
      } else {
        showToast(`Draft Expense ${expenseNumber} saved! Accounts remain unchanged.`, 'info');
      }

      setCreateModalOpen(false);
      resetForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save expense';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Void / Cancel Posted Expense with Reversal
  const handleVoidExpense = async () => {
    if (!expenseToVoid) return;
    if (!voidReason.trim()) {
      showToast('Please specify a reason for voiding this expense.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const nowStr = new Date().toISOString();
      const account = accounts.find((a) => a.id === expenseToVoid.accountId);

      // 1. Restore Cash/Bank balance
      if (account) {
        await accountService.update(account.id, {
          currentBalance: (account.currentBalance || 0) + expenseToVoid.totalAmount,
        });

        // Record refund reversal payment
        await paymentService.create({
          paymentNumber: `REFUND-EXP-${Date.now().toString().slice(-5)}`,
          partyType: 'direct_deposit',
          partyId: account.id,
          partyName: account.accountName,
          type: 'receipt',
          amount: expenseToVoid.totalAmount,
          date: nowStr.split('T')[0],
          accountId: account.id,
          accountName: account.accountName,
          paymentMethod: expenseToVoid.paymentMethod,
          reference: `VOID-${expenseToVoid.expenseNumber}`,
          notes: `Reversal refund for cancelled expense #${expenseToVoid.expenseNumber}: ${voidReason}`,
          status: 'active',
        });
      }

      // 2. Mark expense as void
      await updateItem(expenseToVoid.id, {
        expenseStatus: 'void',
        voidReason,
        voidDate: nowStr,
      });

      // Automatic Double-Entry Journal Reversal
      try {
        const accountingAutomation = new AccountingAutomationService(tenantId);
        await accountingAutomation.reverseJournalByReference(expenseToVoid.expenseNumber, voidReason, user?.uid || 'system');
      } catch (revErr) {
        console.warn('Double-entry journal reversal note:', revErr);
      }

      // 3. Audit Log
      await auditLogService.create({
        action: 'STATUS_CHANGE',
        module: 'Expenses',
        entityId: expenseToVoid.expenseNumber,
        entityName: expenseToVoid.category,
        description: `Cancelled Expense #${expenseToVoid.expenseNumber} ($${expenseToVoid.totalAmount.toFixed(2)}). Reason: ${voidReason}`,
        userId: user?.uid || 'system',
        userName: user?.displayName || 'Administrator',
        userEmail: user?.email || 'admin@erp.com',
        timestamp: nowStr,
      });

      showToast(
        `Expense ${expenseToVoid.expenseNumber} cancelled. ${formatCurrency(expenseToVoid.totalAmount, currencyCode, currencySymbol)} restored to account!`,
        'success'
      );
      setVoidModalOpen(false);
      setExpenseToVoid(null);
      setVoidReason('');
      if (viewExpense?.id === expenseToVoid.id) {
        setViewExpense(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to void expense';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Add Category Handler
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) {
      showToast('Category name is required.', 'error');
      return;
    }
    try {
      const code = newCatCode.trim().toUpperCase() || `CAT-${newCatName.slice(0, 4).toUpperCase()}`;
      await createCategory({
        name: newCatName.trim(),
        code,
        description: newCatDesc.trim() || `Operational overhead category for ${newCatName.trim()}`,
        status: 'active',
      });
      showToast(`Category "${newCatName}" created!`, 'success');
      setNewCatName('');
      setNewCatCode('');
      setNewCatDesc('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add category';
      showToast(msg, 'error');
    }
  };

  // Toggle Category Status (Active / Inactive)
  const handleToggleCategoryStatus = async (cat: Category) => {
    try {
      const newStatus = cat.status === 'inactive' ? 'active' : 'inactive';
      await updateCategory(cat.id, { status: newStatus });
      showToast(`Category "${cat.name}" is now ${newStatus.toUpperCase()}.`, 'info');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update category status';
      showToast(msg, 'error');
    }
  };

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return allExpenses.filter((e) => {
      const effStatus = e.expenseStatus || 'posted';

      // Status Tab
      if (statusTab !== 'all' && effStatus !== statusTab) return false;

      // Category Filter
      if (selectedCategoryFilter !== 'all' && e.category !== selectedCategoryFilter) return false;

      // Date Range
      if (dateFrom && e.date < dateFrom) return false;
      if (dateTo && e.date > dateTo) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          e.expenseNumber?.toLowerCase().includes(q) ||
          e.category?.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q) ||
          e.vendor?.toLowerCase().includes(q) ||
          e.reference?.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [allExpenses, statusTab, selectedCategoryFilter, dateFrom, dateTo, searchQuery]);

  // High-level KPI Computations (Excludes draft and void)
  const stats = useMemo(() => {
    const validExpenses = allExpenses.filter((e) => e.expenseStatus !== 'void' && e.expenseStatus !== 'draft');
    const totalExp = validExpenses.reduce((sum, e) => sum + (e.totalAmount || 0), 0);
    const now = new Date();
    const currentMonthPrefix = now.toISOString().slice(0, 7);
    const thisMonthExp = validExpenses
      .filter((e) => e.date.startsWith(currentMonthPrefix))
      .reduce((sum, e) => sum + (e.totalAmount || 0), 0);

    const totalTax = validExpenses.reduce((sum, e) => sum + (e.taxAmount || 0), 0);
    const draftsCount = allExpenses.filter((e) => e.expenseStatus === 'draft').length;

    return {
      totalExp,
      thisMonthExp,
      totalTax,
      draftsCount,
      count: validExpenses.length,
    };
  }, [allExpenses]);

  // Columns for DataTable
  const columns: Column<Expense>[] = [
    {
      header: 'Expense #',
      accessor: 'expenseNumber',
      sortable: true,
      cell: (exp) => (
        <button
          onClick={() => setViewExpense(exp)}
          className="font-mono font-bold text-slate-900 hover:text-indigo-600 flex items-center gap-1.5"
        >
          <Receipt className="w-3.5 h-3.5 text-slate-500" />
          {exp.expenseNumber}
        </button>
      ),
    },
    {
      header: 'Date',
      accessor: 'date',
      sortable: true,
      cell: (exp) => formatDate(exp.date),
    },
    {
      header: 'Category',
      accessor: 'category',
      sortable: true,
      cell: (exp) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          <Tag className="w-3 h-3 text-slate-500" />
          {exp.category}
        </span>
      ),
    },
    {
      header: 'Description & Payee',
      cell: (exp) => (
        <div>
          <div className="text-xs font-medium text-slate-900">{exp.description}</div>
          {exp.vendor && <div className="text-[10px] text-slate-500">Payee: {exp.vendor}</div>}
        </div>
      ),
    },
    {
      header: 'Account & Method',
      cell: (exp) => (
        <div className="text-xs">
          <div className="font-medium text-slate-800">{exp.accountName}</div>
          <div className="text-[10px] text-slate-500 capitalize">{exp.paymentMethod.replace('_', ' ')}</div>
        </div>
      ),
    },
    {
      header: 'Status',
      cell: (exp) => {
        const st = exp.expenseStatus || 'posted';
        if (st === 'void') {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
              <Ban className="w-3 h-3" /> Void / Cancelled
            </span>
          );
        }
        if (st === 'draft') {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-300">
              <Clock className="w-3 h-3" /> Draft
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Disbursed
          </span>
        );
      },
    },
    {
      header: 'Total Amount',
      accessor: 'totalAmount',
      sortable: true,
      cell: (exp) => (
        <span
          className={`font-semibold font-mono ${
            exp.expenseStatus === 'void'
              ? 'line-through text-slate-400'
              : exp.expenseStatus === 'draft'
              ? 'text-slate-600'
              : 'text-rose-600'
          }`}
        >
          {formatCurrency(exp.totalAmount || 0, currencyCode, currencySymbol)}
        </span>
      ),
    },
    {
      header: 'Actions',
      cell: (exp) => {
        const isDraft = exp.expenseStatus === 'draft';
        const isVoid = exp.expenseStatus === 'void';
        const isPosted = !isDraft && !isVoid;

        return (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setViewExpense(exp)}
              title="View Expense Voucher"
            >
              <Eye className="w-4 h-4 text-slate-600" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => printExpenseVoucher(exp, currentTenant)}
              title="Print Official Expense Voucher"
            >
              <Printer className="w-4 h-4 text-indigo-600" />
            </Button>

            {isDraft && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleOpenEditDraftModal(exp)}
                title="Edit Draft Expense"
                className="text-amber-600 hover:bg-amber-50"
              >
                <Edit3 className="w-4 h-4" />
              </Button>
            )}

            {isPosted && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setExpenseToVoid(exp);
                  setVoidReason('');
                  setVoidModalOpen(true);
                }}
                title="Cancel / Void Expense"
                className="text-rose-600 hover:bg-rose-50"
              >
                <Ban className="w-4 h-4" />
              </Button>
            )}

            {isDraft && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (confirm(`Delete draft expense voucher ${exp.expenseNumber}?`)) {
                    softDeleteItem(exp.id);
                    showToast(`Draft expense ${exp.expenseNumber} deleted.`, 'info');
                  }
                }}
                title="Delete Draft"
              >
                <Trash2 className="w-4 h-4 text-rose-500" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Operating Expenses"
        description="Track operational expenses, cost categories, tax deductions, vouchers, and real-time cash/bank disbursements."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Expenses' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setCategoryModalOpen(true)}
              className="flex items-center gap-1.5 border-slate-300 text-slate-700"
            >
              <Settings2 className="w-4 h-4 text-slate-500" />
              Manage Categories
            </Button>
            <Button
              onClick={handleOpenCreateModal}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Record Expense
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Expenses
            </span>
            <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-600 mt-2 font-mono">
            {formatCurrency(stats.totalExp, currencyCode, currencySymbol)}
          </div>
          <div className="text-xs text-slate-500 mt-1">From {stats.count} posted vouchers</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              This Month
            </span>
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-2 font-mono">
            {formatCurrency(stats.thisMonthExp, currencyCode, currencySymbol)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Current calendar month</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Tax Deductible
            </span>
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {formatCurrency(stats.totalTax, currencyCode, currencySymbol)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Total deductible tax/VAT</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Draft Quotations
            </span>
            <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
              <Edit3 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-700 mt-2 font-mono">
            {stats.draftsCount}
          </div>
          <div className="text-xs text-slate-500 mt-1">Unposted expense drafts</div>
        </div>
      </div>

      {/* Lifecycle Status Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
        {[
          { id: 'all', label: 'All Expenses' },
          { id: 'posted', label: 'Disbursed / Final' },
          { id: 'draft', label: 'Drafts' },
          { id: 'void', label: 'Cancelled / Void' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setStatusTab(tab.id as any)}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
              statusTab === tab.id
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-52">
            <Select
              options={[
                { label: 'All Categories', value: 'all' },
                ...categories.map((c) => ({
                  label: `${c.name} ${c.status === 'inactive' ? '(Inactive)' : ''}`,
                  value: c.name,
                })),
              ]}
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span>From:</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-xs border border-slate-300 rounded px-2 py-1"
            />
            <span>To:</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-xs border border-slate-300 rounded px-2 py-1"
            />
          </div>
        </div>

        <div className="text-xs text-slate-500 font-mono">
          Showing {filteredExpenses.length} of {allExpenses.length} expenses
        </div>
      </div>

      {/* DataTable */}
      <DataTable<Expense>
        data={filteredExpenses}
        columns={columns}
        loading={loading}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        totalCount={filteredExpenses.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSortChange={(field: string) => setSortBy(field)}
      />

      {/* CREATE / EDIT EXPENSE MODAL */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          resetForm();
        }}
        title={editingExpense ? `Edit Expense ${editingExpense.expenseNumber}` : 'Record Operating Expense'}
        description="Enter expense details, tax deduction, and choose the bank or cash drawer to debit."
        maxWidth="lg"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSubmitExpense(false); }} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Expense Category *</label>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                options={activeCategories.map((c) => ({ label: c.name, value: c.name }))}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Expense Date *</label>
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
                Net Amount ({currencySymbol}) *
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
                Tax / VAT Amount ({currencySymbol})
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={taxAmount}
                onChange={(e) => setTaxAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Disbursement Account *</label>
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
              <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
              <Select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                options={[
                  { label: 'Cash Drawer', value: 'cash' },
                  { label: 'Bank Transfer', value: 'bank_transfer' },
                  { label: 'Credit Card', value: 'credit_card' },
                  { label: 'Cheque', value: 'cheque' },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Vendor / Payee</label>
              <Input
                type="text"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="e.g. Austin Industrial Energy"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Bill / Receipt Ref #</label>
              <Input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. BILL-99201"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Purpose</label>
            <Input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Monthly electricity bill for central warehouse"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Internal Notes</label>
            <textarea
              rows={2}
              className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500"
              placeholder="Auditor notes, tax deductibility details, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSubmitExpense(true)}
              disabled={submitting}
              className="border-slate-300 text-slate-700"
            >
              {editingExpense ? 'Save Changes as Draft' : 'Save as Draft'}
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCreateModalOpen(false);
                  resetForm();
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                {submitting ? 'Processing...' : 'Post Expense & Deduct Funds'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* VOID / CANCEL EXPENSE MODAL */}
      {voidModalOpen && expenseToVoid && (
        <Modal
          isOpen={voidModalOpen}
          onClose={() => setVoidModalOpen(false)}
          title={`Cancel Expense ${expenseToVoid.expenseNumber}`}
          description="Cancelling will restore the disbursed amount to the source bank/cash account."
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Accounting Refund Notice:</strong> Cancelling generates a counter refund receipt of{' '}
                <span className="font-bold font-mono">
                  {formatCurrency(expenseToVoid.totalAmount, currencyCode, currencySymbol)}
                </span>{' '}
                into <span className="font-bold">{expenseToVoid.accountName}</span>.
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Cancellation *
              </label>
              <textarea
                rows={3}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-1 focus:ring-rose-500"
                placeholder="e.g., Duplicate voucher entry, vendor refunded payment, wrong account debited..."
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <Button
                variant="ghost"
                onClick={() => setVoidModalOpen(false)}
                disabled={submitting}
              >
                Go Back
              </Button>
              <Button
                onClick={handleVoidExpense}
                disabled={submitting}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {submitting ? 'Reversing...' : 'Confirm Cancellation & Restore Funds'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MANAGE CATEGORIES MODAL */}
      {categoryModalOpen && (
        <Modal
          isOpen={categoryModalOpen}
          onClose={() => setCategoryModalOpen(false)}
          title="Manage Expense Categories"
          description="Enable, disable, or add custom operating expense classification categories."
          maxWidth="2xl"
        >
          <div className="space-y-6">
            {/* Add New Category Form */}
            <form onSubmit={handleAddCategory} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Add New Category</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Category Name *</label>
                  <Input
                    type="text"
                    placeholder="e.g. Equipment Rental"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Code (Optional)</label>
                  <Input
                    type="text"
                    placeholder="e.g. CAT-RENT"
                    value={newCatCode}
                    onChange={(e) => setNewCatCode(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="Short description / purpose"
                    value={newCatDesc}
                    onChange={(e) => setNewCatDesc(e.target.value)}
                  />
                </div>
                <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Category
                </Button>
              </div>
            </form>

            {/* Existing Categories Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2.5 px-3 text-left">Category Name</th>
                    <th className="py-2.5 px-3 text-left">Code</th>
                    <th className="py-2.5 px-3 text-left">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800">{cat.name}</div>
                        {cat.description && <div className="text-[10px] text-slate-400">{cat.description}</div>}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">{cat.code}</td>
                      <td className="py-2.5 px-3">
                        {cat.status === 'inactive' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-300">
                            Inactive (Hidden)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active (Available)
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleCategoryStatus(cat)}
                          className={cat.status === 'inactive' ? 'text-emerald-600 font-bold' : 'text-slate-500'}
                        >
                          {cat.status === 'inactive' ? 'Enable' : 'Disable'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setCategoryModalOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* VIEW EXPENSE / VOUCHER MODAL */}
      {viewExpense && (
        <Modal
          isOpen={Boolean(viewExpense)}
          onClose={() => setViewExpense(null)}
          title={`Expense Voucher ${viewExpense.expenseNumber}`}
          description="Expense details, tax breakdown, and printable voucher"
          maxWidth="md"
        >
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-bold uppercase">Status</span>
                <span className="text-xs font-bold">
                  {viewExpense.expenseStatus === 'void' ? (
                    <span className="text-rose-600 flex items-center gap-1"><Ban className="w-3.5 h-3.5" /> Void / Cancelled</span>
                  ) : viewExpense.expenseStatus === 'draft' ? (
                    <span className="text-amber-600 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Draft Quotation</span>
                  ) : (
                    <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Disbursed</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-bold uppercase">Category</span>
                <span className="text-xs font-semibold text-slate-800">{viewExpense.category}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-bold uppercase">Total Disbursed</span>
                <span className={`text-xl font-bold font-mono ${viewExpense.expenseStatus === 'void' ? 'line-through text-slate-400' : 'text-rose-600'}`}>
                  {formatCurrency(viewExpense.totalAmount, currencyCode, currencySymbol)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500 font-bold uppercase">Paid From</span>
                <span className="text-xs font-semibold text-slate-800">{viewExpense.accountName}</span>
              </div>
              {viewExpense.vendor && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-bold uppercase">Payee / Vendor</span>
                  <span className="text-xs text-slate-800 font-medium">{viewExpense.vendor}</span>
                </div>
              )}
              {viewExpense.reference && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 font-bold uppercase">Receipt #</span>
                  <span className="text-xs font-mono text-slate-600">{viewExpense.reference}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 text-xs text-slate-600">
                <span className="font-bold">Memo: </span>{viewExpense.description}
              </div>
              {viewExpense.notes && (
                <div className="text-xs text-slate-500 italic">
                  <span className="font-semibold">Notes: </span>{viewExpense.notes}
                </div>
              )}
              {viewExpense.voidReason && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                  <span className="font-bold">Cancelled on {formatDate(viewExpense.voidDate || '')}: </span>
                  {viewExpense.voidReason}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => printExpenseVoucher(viewExpense, currentTenant)}
                className="flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4 text-indigo-600" /> Print Official Voucher
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewExpense(null)}
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

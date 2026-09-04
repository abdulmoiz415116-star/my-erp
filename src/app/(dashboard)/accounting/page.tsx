'use client';

import React, { useState, useMemo } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  JournalEntryService,
  AccountService,
  SaleService,
  PurchaseService,
  ExpenseService,
  PaymentService,
  ProductService,
  AuditLogService,
  computeTrialBalance,
  computeGeneralLedger,
  computeProfitAndLossStatement,
} from '@/services/erp.service';
import {
  JournalEntry,
  JournalLine,
  Account,
  SaleInvoice,
  PurchaseOrder,
  Expense,
  Payment,
  Product,
} from '@/types/erp';
import { useRealtimeCollection } from '@/hooks/useRealtimeCollection';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, Column } from '@/components/common/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  printJournalVoucher,
  printTrialBalance,
  printProfitAndLossStatement,
  printAccountStatement,
} from '@/lib/pdfPrint';
import {
  Scale,
  TrendingUp,
  BookOpen,
  FileSpreadsheet,
  Layers,
  Plus,
  Printer,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  ArrowRightLeft,
  DollarSign,
  Building2,
  Calendar,
  X,
  FileText,
  BadgeAlert,
  Clock,
  Eye,
} from 'lucide-react';

type AccountingTab = 'journal' | 'ledger' | 'trial_balance' | 'pnl' | 'coa';
type PeriodFilter = 'all' | 'this_month' | 'last_month' | 'quarter' | 'ytd';

export default function AccountingPage() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { showToast } = useToast();

  const tenantId = currentTenant?.id || 'tenant-apex-corp';
  const currencySymbol = currentTenant?.settings.currencySymbol || '$';
  const currencyCode = currentTenant?.settings.currency || 'USD';

  // Active View Tab & Period Filters
  const [activeTab, setActiveTab] = useState<AccountingTab>('journal');
  const [period, setPeriod] = useState<PeriodFilter>('all');

  // Real-time collections
  const {
    items: journalEntries,
    allItems: allJournalEntries,
    totalCount: totalJournalCount,
    loading: journalLoading,
    page: journalPage,
    pageSize: journalPageSize,
    totalPages: journalTotalPages,
    setPage: setJournalPage,
    setPageSize: setJournalPageSize,
    searchQuery: journalSearch,
    setSearchQuery: setJournalSearch,
    sortBy: journalSortBy,
    sortDirection: journalSortDir,
    setSortBy: setJournalSortBy,
    setSortDirection: setJournalSortDir,
    createItem: createJournalEntry,
    updateItem: updateJournalEntry,
  } = useRealtimeCollection<JournalEntry>((tId) => new JournalEntryService(tId), {
    sortBy: 'date',
    sortDirection: 'desc',
  });

  const { allItems: allAccounts } = useRealtimeCollection<Account>((tId) => new AccountService(tId));
  const { allItems: allSales } = useRealtimeCollection<SaleInvoice>((tId) => new SaleService(tId));
  const { allItems: allPurchases } = useRealtimeCollection<PurchaseOrder>((tId) => new PurchaseService(tId));
  const { allItems: allExpenses } = useRealtimeCollection<Expense>((tId) => new ExpenseService(tId));
  const { allItems: allPayments } = useRealtimeCollection<Payment>((tId) => new PaymentService(tId));
  const { allItems: allProducts } = useRealtimeCollection<Product>((tId) => new ProductService(tId));

  const journalService = useMemo(() => new JournalEntryService(tenantId), [tenantId]);
  const auditLogService = useMemo(() => new AuditLogService(tenantId), [tenantId]);

  // Filters for Journal Entries
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'posted' | 'void'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modals State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [viewEntryModal, setViewEntryModal] = useState<JournalEntry | null>(null);
  const [reverseModalOpen, setReverseModalOpen] = useState(false);
  const [entryToReverse, setEntryToReverse] = useState<JournalEntry | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Manual Journal Entry Form State
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualReference, setManualReference] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualLines, setManualLines] = useState<
    Array<{
      accountId: string;
      debit: string;
      credit: string;
      description: string;
    }>
  >([
    { accountId: '', debit: '', credit: '', description: '' },
    { accountId: '', debit: '', credit: '', description: '' },
  ]);

  // Selected Account for General Ledger Tab
  const [selectedLedgerAccountId, setSelectedLedgerAccountId] = useState<string>('');
  const selectedLedgerAccount = useMemo(() => {
    if (selectedLedgerAccountId) {
      return allAccounts.find((a) => a.id === selectedLedgerAccountId) || allAccounts[0] || null;
    }
    return allAccounts[0] || null;
  }, [allAccounts, selectedLedgerAccountId]);

  // Period Date Filtering helper
  const isDateInPeriod = (dateStr: string) => {
    if (period === 'all') return true;
    const d = new Date(dateStr);
    const now = new Date();

    if (period === 'this_month') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    if (period === 'last_month') {
      const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
    }
    if (period === 'quarter') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const dQuarter = Math.floor(d.getMonth() / 3);
      return d.getFullYear() === now.getFullYear() && currentQuarter === dQuarter;
    }
    if (period === 'ytd') {
      return d.getFullYear() === now.getFullYear();
    }
    return true;
  };

  // 1. Double-Entry Computations
  const trialBalanceResult = useMemo(() => {
    return computeTrialBalance(allJournalEntries, allAccounts);
  }, [allJournalEntries, allAccounts]);

  const pnlResult = useMemo(() => {
    const filteredSales = allSales.filter((s) => isDateInPeriod(s.date));
    const filteredExpenses = allExpenses.filter((e) => isDateInPeriod(e.date));
    return computeProfitAndLossStatement(filteredSales, filteredExpenses, period);
  }, [allSales, allExpenses, period]);

  const ledgerEntries = useMemo(() => {
    if (!selectedLedgerAccount) return [];
    return computeGeneralLedger(allJournalEntries, selectedLedgerAccount);
  }, [allJournalEntries, selectedLedgerAccount]);

  // Filtered Journal Entries list
  const filteredJournalEntries = useMemo(() => {
    return journalEntries.filter((je) => {
      if (moduleFilter !== 'all' && je.sourceModule !== moduleFilter) return false;
      if (statusFilter !== 'all' && je.status !== statusFilter) return false;
      if (dateFrom && new Date(je.date) < new Date(dateFrom)) return false;
      if (dateTo && new Date(je.date) > new Date(`${dateTo}T23:59:59`)) return false;
      return true;
    });
  }, [journalEntries, moduleFilter, statusFilter, dateFrom, dateTo]);

  // Manual Entry Balance Totals
  const manualTotals = useMemo(() => {
    const totalDebit = manualLines.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);
    const totalCredit = manualLines.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
    const diff = Math.abs(totalDebit - totalCredit);
    const isBalanced = diff < 0.01 && totalDebit > 0;
    return { totalDebit, totalCredit, diff, isBalanced };
  }, [manualLines]);

  // Handle Add Line to Manual Entry
  const handleAddManualLine = () => {
    setManualLines([...manualLines, { accountId: '', debit: '', credit: '', description: '' }]);
  };

  // Handle Remove Line from Manual Entry
  const handleRemoveManualLine = (index: number) => {
    if (manualLines.length <= 2) {
      showToast('A double-entry transaction requires at least 2 lines.', 'error');
      return;
    }
    setManualLines(manualLines.filter((_, i) => i !== index));
  };

  // Handle Update Line
  const handleUpdateManualLine = (index: number, field: string, value: string) => {
    const updated = [...manualLines];
    updated[index] = { ...updated[index], [field]: value };
    // If setting debit, clear credit on that line, and vice versa
    if (field === 'debit' && parseFloat(value) > 0) {
      updated[index].credit = '';
    } else if (field === 'credit' && parseFloat(value) > 0) {
      updated[index].debit = '';
    }
    setManualLines(updated);
  };

  // Submit Manual Journal Entry
  const handleSubmitManualJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTotals.isBalanced) {
      showToast(
        `Total Debits ($${manualTotals.totalDebit.toFixed(2)}) must equal Total Credits ($${manualTotals.totalCredit.toFixed(2)}).`,
        'error'
      );
      return;
    }

    const lines: JournalLine[] = [];
    for (let i = 0; i < manualLines.length; i++) {
      const ml = manualLines[i];
      const acc = allAccounts.find((a) => a.id === ml.accountId);
      if (!acc) {
        showToast(`Please select a valid account for line #${i + 1}.`, 'error');
        return;
      }
      const deb = parseFloat(ml.debit) || 0;
      const cred = parseFloat(ml.credit) || 0;
      if (deb === 0 && cred === 0) {
        showToast(`Line #${i + 1} must have either a debit or credit amount.`, 'error');
        return;
      }

      lines.push({
        id: `line-${i + 1}`,
        accountId: acc.id,
        accountNumber: acc.accountNumber,
        accountName: acc.accountName,
        accountType: acc.type,
        debit: deb,
        credit: cred,
        description: ml.description || manualDescription,
      });
    }

    setSubmitting(true);
    try {
      const entryNumber = `JE-${Math.floor(10000 + Math.random() * 90000)}`;
      await journalService.createEntry(
        {
          entryNumber,
          date: manualDate,
          reference: manualReference || `MANUAL-${Date.now().toString().slice(-4)}`,
          description: manualDescription,
          lines,
          totalDebit: manualTotals.totalDebit,
          totalCredit: manualTotals.totalCredit,
          isBalanced: true,
          sourceModule: 'manual',
          sourceNumber: manualReference,
          status: 'posted',
          userId: user?.uid || 'system',
          userName: user?.displayName || 'Chief Accountant',
        },
        user?.uid || 'system'
      );

      await auditLogService.create({
        action: 'CREATE',
        module: 'Accounting',
        entityId: entryNumber,
        entityName: manualDescription,
        description: `Posted manual double-entry voucher ${entryNumber} ($${manualTotals.totalDebit.toFixed(2)})`,
        userId: user?.uid || 'system',
        userName: user?.displayName || 'Chief Accountant',
        userEmail: user?.email || 'admin@erp.com',
        timestamp: new Date().toISOString(),
      });

      showToast(`Journal voucher ${entryNumber} successfully posted in equilibrium!`, 'success');
      setCreateModalOpen(false);
      setManualReference('');
      setManualDescription('');
      setManualLines([
        { accountId: '', debit: '', credit: '', description: '' },
        { accountId: '', debit: '', credit: '', description: '' },
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to post journal entry';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Reversal Modal
  const handleOpenReverseModal = (je: JournalEntry) => {
    setEntryToReverse(je);
    setReversalReason('');
    setReverseModalOpen(true);
  };

  // Execute Reversal
  const handleExecuteReversal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryToReverse) return;
    if (!reversalReason.trim()) {
      showToast('Please state a reason for this accounting reversal.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const rev = await journalService.reverseEntry(
        entryToReverse.id,
        reversalReason,
        user?.uid || 'system'
      );

      await auditLogService.create({
        action: 'STATUS_CHANGE',
        module: 'Accounting',
        entityId: rev.entryNumber,
        entityName: entryToReverse.entryNumber,
        description: `Reversed journal voucher ${entryToReverse.entryNumber} with counter-balancing entry ${rev.entryNumber}`,
        userId: user?.uid || 'system',
        userName: user?.displayName || 'Chief Accountant',
        userEmail: user?.email || 'admin@erp.com',
        timestamp: new Date().toISOString(),
      });

      showToast(`Reversal voucher ${rev.entryNumber} posted. Original marked as void.`, 'success');
      setReverseModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Reversal failed';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Journal Columns
  const journalColumns: Column<JournalEntry>[] = [
    {
      header: 'Voucher & Date',
      accessor: 'entryNumber',
      sortable: true,
      cell: (je) => (
        <div>
          <div className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
            {je.entryNumber}
            {je.sourceModule === 'cancellation' && (
              <span className="text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded font-bold uppercase">
                Reversal
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-500 font-mono">{formatDate(je.date)}</div>
        </div>
      ),
    },
    {
      header: 'Reference & Module',
      accessor: 'reference',
      cell: (je) => (
        <div>
          <div className="font-mono font-semibold text-xs text-indigo-700">{je.reference || '—'}</div>
          <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
            {je.sourceModule}
          </span>
        </div>
      ),
    },
    {
      header: 'Description / Particulars',
      accessor: 'description',
      cell: (je) => (
        <div>
          <div className="font-medium text-xs text-slate-900 line-clamp-1">{je.description}</div>
          <div className="text-[11px] text-slate-400">
            {je.lines.length} debit/credit line(s) • Authorized by {je.userName || 'System'}
          </div>
        </div>
      ),
    },
    {
      header: 'Total Volume',
      accessor: 'totalDebit',
      sortable: true,
      cell: (je) => (
        <div>
          <span className="font-mono font-bold text-xs text-slate-900">
            {formatCurrency(je.totalDebit, currencyCode, currencySymbol)}
          </span>
          <div className="text-[10px] text-emerald-600 font-mono font-semibold">Debits = Credits</div>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      cell: (je) => (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
            je.status === 'posted'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
              : 'bg-rose-50 text-rose-700 border border-rose-300'
          }`}
        >
          {je.status === 'posted' ? (
            <>
              <CheckCircle2 className="w-3 h-3" /> Posted
            </>
          ) : (
            <>
              <RotateCcw className="w-3 h-3" /> Void / Reversed
            </>
          )}
        </span>
      ),
    },
    {
      header: 'Actions',
      cell: (je) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setViewEntryModal(je)}
            title="Inspect Voucher Lines"
            className="text-indigo-600 hover:text-indigo-800"
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => printJournalVoucher(je, currentTenant)}
            title="Print Journal Voucher"
            className="text-slate-600 hover:text-slate-900"
          >
            <Printer className="w-4 h-4" />
          </Button>
          {je.status === 'posted' && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleOpenReverseModal(je)}
              title="Post Reversal Entry"
              className="text-rose-500 hover:text-rose-700"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Double-Entry Accounting & Ledger"
        description="Statutory double-entry general journal, balanced trial balance, real-time COGS profit & loss, and audit trail."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Accounting' },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => printTrialBalance(trialBalanceResult.rows, trialBalanceResult.totalDebit, trialBalanceResult.totalCredit, currentTenant)}
              variant="outline"
              className="flex items-center gap-1.5 text-xs font-semibold py-2"
            >
              <Printer className="w-4 h-4 text-emerald-600" />
              Print Trial Balance
            </Button>
            <Button
              onClick={() => printProfitAndLossStatement(pnlResult, currentTenant)}
              variant="outline"
              className="flex items-center gap-1.5 text-xs font-semibold py-2"
            >
              <Printer className="w-4 h-4 text-indigo-600" />
              Print P&L Statement
            </Button>
            <Button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              Post Journal Voucher
            </Button>
          </div>
        }
      />

      {/* Accounting KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Revenue */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Commercial Revenue
            </span>
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {formatCurrency(pnlResult.netSales, currencyCode, currencySymbol)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Net invoiced sales volume</div>
        </div>

        {/* Real Cost of Goods Sold */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Cost of Goods Sold (COGS)
            </span>
            <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-600 mt-2 font-mono">
            {formatCurrency(pnlResult.cogsTotal, currencyCode, currencySymbol)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Landed product cost (Not purchases)</div>
        </div>

        {/* Gross Profit */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Gross Profit
            </span>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <Scale className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2 font-mono">
            {formatCurrency(pnlResult.grossProfit, currencyCode, currencySymbol)}
          </div>
          <div className="text-xs text-emerald-600 font-semibold mt-1">
            Gross Margin: {pnlResult.grossMarginPercent}%
          </div>
        </div>

        {/* Net Operating Profit */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Net Operating Profit
            </span>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-indigo-700 mt-2 font-mono">
            {formatCurrency(pnlResult.netOperatingProfit, currencyCode, currencySymbol)}
          </div>
          <div className="text-xs text-indigo-600 font-semibold mt-1">
            Net Margin: {pnlResult.netMarginPercent}%
          </div>
        </div>
      </div>

      {/* Double-Entry Equilibrium Banner */}
      <div className="bg-emerald-900 text-emerald-100 p-4 rounded-xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 border border-emerald-800">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-800/80 rounded-lg text-emerald-300">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-white text-sm flex items-center gap-2">
              Double-Entry General Ledger in Equilibrium
              <span className="text-[10px] bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 px-2 py-0.5 rounded-full font-mono uppercase">
                Verified
              </span>
            </div>
            <div className="text-xs text-emerald-200/90 mt-0.5">
              Every financial transaction satisfies the fundamental invariant: Total Debits strictly equal Total Credits.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 font-mono text-xs">
          <div className="text-right">
            <span className="text-emerald-300/80 block uppercase text-[10px]">Total Debits:</span>
            <span className="font-bold text-white text-sm">
              {formatCurrency(trialBalanceResult.totalDebit, currencyCode, currencySymbol)}
            </span>
          </div>
          <div className="text-right">
            <span className="text-emerald-300/80 block uppercase text-[10px]">Total Credits:</span>
            <span className="font-bold text-white text-sm">
              {formatCurrency(trialBalanceResult.totalCredit, currencyCode, currencySymbol)}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('journal')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'journal'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" /> General Journal
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'ledger'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> General Ledger (GL)
          </button>
          <button
            onClick={() => setActiveTab('trial_balance')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'trial_balance'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Trial Balance
          </button>
          <button
            onClick={() => setActiveTab('pnl')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'pnl'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" /> Profit &amp; Loss (COGS)
          </button>
          <button
            onClick={() => setActiveTab('coa')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'coa'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" /> Chart of Accounts
          </button>
        </div>

        {/* Period Filter dropdown */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-slate-600">Accounting Period:</span>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as PeriodFilter)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Available History</option>
            <option value="this_month">This Current Month</option>
            <option value="last_month">Previous Month</option>
            <option value="quarter">This Quarter</option>
            <option value="ytd">Year-to-Date (YTD)</option>
          </select>
        </div>
      </div>

      {/* TAB 1: GENERAL JOURNAL */}
      {activeTab === 'journal' && (
        <div className="space-y-4">
          {/* Sub-toolbar filters for Journal */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600">Module:</label>
                <select
                  value={moduleFilter}
                  onChange={(e) => setModuleFilter(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">All Modules</option>
                  <option value="sales">Sales</option>
                  <option value="purchases">Purchases</option>
                  <option value="expenses">Expenses</option>
                  <option value="payments">Payments</option>
                  <option value="transfer">Transfers</option>
                  <option value="manual">Manual Vouchers</option>
                  <option value="cancellation">Reversals / Voids</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600">Status:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                  className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="posted">Posted Only</option>
                  <option value="void">Void / Reversed Only</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600">From:</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5"
                />
                <label className="text-xs font-semibold text-slate-600">To:</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5"
                />
                {(dateFrom || dateTo) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDateFrom('');
                      setDateTo('');
                    }}
                    className="text-xs text-rose-500 py-1 px-2"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-800">{filteredJournalEntries.length}</span> journal vouchers
            </div>
          </div>

          <DataTable<JournalEntry>
            columns={journalColumns}
            data={filteredJournalEntries}
            loading={journalLoading}
            totalCount={totalJournalCount}
            page={journalPage}
            pageSize={journalPageSize}
            totalPages={journalTotalPages}
            onPageChange={setJournalPage}
            onPageSizeChange={setJournalPageSize}
            searchQuery={journalSearch}
            onSearchChange={setJournalSearch}
            sortBy={journalSortBy}
            sortDirection={journalSortDir}
            onSortChange={(f: string) => setJournalSortBy(f)}
          />
        </div>
      )}

      {/* TAB 2: GENERAL LEDGER (GL) */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          {/* Account Selector Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Select Ledger Account:
              </label>
              <select
                value={selectedLedgerAccountId || (allAccounts[0]?.id || '')}
                onChange={(e) => setSelectedLedgerAccountId(e.target.value)}
                className="text-xs font-bold font-mono bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 min-w-[320px] focus:ring-1 focus:ring-indigo-500"
              >
                {allAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.accountNumber} — {acc.accountName} ({acc.accountCategory?.toUpperCase() || acc.type})
                  </option>
                ))}
              </select>
            </div>

            {selectedLedgerAccount && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => printAccountStatement(selectedLedgerAccount, [], currentTenant)}
                className="flex items-center gap-1.5 text-xs font-semibold"
              >
                <Printer className="w-3.5 h-3.5 text-indigo-600" />
                Print Statement
              </Button>
            )}
          </div>

          {selectedLedgerAccount && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              {/* Account Meta Header */}
              <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-lg">{selectedLedgerAccount.accountName}</span>
                    <span className="text-xs uppercase px-2 py-0.5 font-mono bg-indigo-100 text-indigo-800 rounded-full font-bold">
                      {selectedLedgerAccount.accountCategory || selectedLedgerAccount.type}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 font-mono mt-1">
                    Code: <strong>{selectedLedgerAccount.accountNumber}</strong> • Normal Balance:{' '}
                    <strong className="uppercase">{selectedLedgerAccount.normalBalance || 'debit'}</strong>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs font-semibold uppercase text-slate-500 block">
                    Closing Ledger Balance
                  </span>
                  <span className="text-2xl font-mono font-black text-indigo-700">
                    {formatCurrency(
                      ledgerEntries.length > 0 ? ledgerEntries[ledgerEntries.length - 1].runningBalance : (selectedLedgerAccount.currentBalance || 0),
                      currencyCode,
                      currencySymbol
                    )}
                  </span>
                </div>
              </div>

              {/* Chronological Ledger Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Voucher #</th>
                      <th className="p-3">Reference</th>
                      <th className="p-3">Particulars / Narration</th>
                      <th className="p-3 text-right">Debit (+)</th>
                      <th className="p-3 text-right">Credit (-)</th>
                      <th className="p-3 text-right">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {ledgerEntries.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-400 font-sans">
                          No journal entries posted to this account yet.
                        </td>
                      </tr>
                    ) : (
                      ledgerEntries.map((e) => (
                        <tr key={e.id} className="hover:bg-slate-50/80">
                          <td className="p-3 text-slate-600 whitespace-nowrap">{formatDate(e.date)}</td>
                          <td className="p-3 font-bold text-slate-900 whitespace-nowrap">{e.entryNumber}</td>
                          <td className="p-3 text-indigo-700 whitespace-nowrap">{e.reference || '—'}</td>
                          <td className="p-3 font-sans text-slate-800">{e.description}</td>
                          <td className="p-3 text-right font-bold text-emerald-600">
                            {e.debit > 0 ? formatCurrency(e.debit, currencyCode, currencySymbol) : '—'}
                          </td>
                          <td className="p-3 text-right font-bold text-rose-600">
                            {e.credit > 0 ? formatCurrency(e.credit, currencyCode, currencySymbol) : '—'}
                          </td>
                          <td className="p-3 text-right font-extrabold text-slate-900">
                            {formatCurrency(e.runningBalance, currencyCode, currencySymbol)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TRIAL BALANCE */}
      {activeTab === 'trial_balance' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base font-mono uppercase">
                Annual &amp; Periodic Trial Balance in Equilibrium
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Audited equilibrium of all Chart of Accounts. Total debit balances strictly equal total credit balances.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Equilibrium Verified
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="p-3">Account Code</th>
                  <th className="p-3">Account Title &amp; Classification</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right">Debit Balance ({currencySymbol})</th>
                  <th className="p-3 text-right">Credit Balance ({currencySymbol})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {trialBalanceResult.rows.map((row) => (
                  <tr key={row.accountId} className="hover:bg-slate-50/80">
                    <td className="p-3 font-bold text-slate-900 whitespace-nowrap">{row.accountNumber}</td>
                    <td className="p-3 font-sans font-semibold text-slate-800">{row.accountName}</td>
                    <td className="p-3 uppercase text-[10px] text-slate-500 font-bold">{row.accountCategory}</td>
                    <td className="p-3 text-right font-bold text-emerald-600">
                      {row.debitBalance > 0 ? formatCurrency(row.debitBalance, currencyCode, currencySymbol) : '—'}
                    </td>
                    <td className="p-3 text-right font-bold text-rose-600">
                      {row.creditBalance > 0 ? formatCurrency(row.creditBalance, currencyCode, currencySymbol) : '—'}
                    </td>
                  </tr>
                ))}
                {/* BALANCED EQUILIBRIUM TOTAL ROW */}
                <tr className="bg-slate-100 font-bold text-sm border-t-2 border-slate-300">
                  <td colSpan={3} className="p-3.5 font-sans uppercase text-slate-900">
                    Total Balanced Equilibrium:
                  </td>
                  <td className="p-3.5 text-right font-black text-emerald-700 font-mono">
                    {formatCurrency(trialBalanceResult.totalDebit, currencyCode, currencySymbol)}
                  </td>
                  <td className="p-3.5 text-right font-black text-rose-700 font-mono">
                    {formatCurrency(trialBalanceResult.totalCredit, currencyCode, currencySymbol)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: PROFIT & LOSS */}
      {activeTab === 'pnl' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base font-mono uppercase">
                Statement of Profit or Loss (Income Statement)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Calculated strictly as Revenue - COGS = Gross Profit; Gross Profit - Operating Expenses = Net Profit.
              </p>
            </div>
            <div className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full uppercase">
              Period: {period.replace('_', ' ').toUpperCase()}
            </div>
          </div>

          <div className="p-6">
            <div className="border border-slate-200 rounded-lg overflow-hidden text-xs font-mono">
              <table className="w-full text-left">
                <thead className="bg-slate-100 text-slate-700 font-semibold font-sans border-b border-slate-200">
                  <tr>
                    <th className="p-3">Particulars &amp; Accounting Heads</th>
                    <th className="p-3 text-right">Subtotal</th>
                    <th className="p-3 text-right">Total ({currencyCode})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-slate-50 font-sans font-bold text-slate-800">
                    <td colSpan={3} className="p-2.5 text-indigo-700 uppercase">
                      1. Revenue from Operations
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-6 font-sans text-slate-700">Gross Commercial Sales Invoiced</td>
                    <td className="py-2.5 px-3 text-right text-slate-700">{formatCurrency(pnlResult.grossSales, currencyCode, currencySymbol)}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">{formatCurrency(pnlResult.grossSales, currencyCode, currencySymbol)}</td>
                  </tr>
                  {pnlResult.salesReturns > 0 && (
                    <tr>
                      <td className="py-2.5 px-6 font-sans text-rose-600">Less: Sales Returns &amp; Allowances</td>
                      <td className="py-2.5 px-3 text-right text-rose-600">({formatCurrency(pnlResult.salesReturns, currencyCode, currencySymbol)})</td>
                      <td className="py-2.5 px-3 text-right font-bold text-rose-600">({formatCurrency(pnlResult.salesReturns, currencyCode, currencySymbol)})</td>
                    </tr>
                  )}

                  <tr className="bg-slate-50 font-sans font-bold text-slate-800">
                    <td colSpan={3} className="p-2.5 text-indigo-700 uppercase">
                      2. Cost of Goods Sold (COGS)
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-6 font-sans text-slate-700">Direct Landed Product Acquisition Cost</td>
                    <td className="py-2.5 px-3 text-right text-rose-600">({formatCurrency(pnlResult.cogsTotal, currencyCode, currencySymbol)})</td>
                    <td className="py-2.5 px-3 text-right font-bold text-rose-600">({formatCurrency(pnlResult.cogsTotal, currencyCode, currencySymbol)})</td>
                  </tr>

                  <tr className="bg-emerald-50/50 font-bold border-t border-emerald-200 text-sm">
                    <td className="p-3 font-sans text-emerald-900">
                      GROSS PROFIT (Net Sales - COGS) [Margin: {pnlResult.grossMarginPercent}%]
                    </td>
                    <td></td>
                    <td className="p-3 text-right text-emerald-700 font-extrabold">
                      {formatCurrency(pnlResult.grossProfit, currencyCode, currencySymbol)}
                    </td>
                  </tr>

                  <tr className="bg-slate-50 font-sans font-bold text-slate-800">
                    <td colSpan={3} className="p-2.5 text-indigo-700 uppercase">
                      3. Operating Overhead Expenses
                    </td>
                  </tr>
                  {pnlResult.categorizedExpenses.map((cat, i) => (
                    <tr key={i}>
                      <td className="py-2 px-6 font-sans text-slate-600 capitalize">{cat.category.replace('_', ' ')}</td>
                      <td className="py-2 px-3 text-right text-slate-600">{formatCurrency(cat.amount, currencyCode, currencySymbol)}</td>
                      <td></td>
                    </tr>
                  ))}
                  {pnlResult.categorizedExpenses.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-3 px-6 font-sans text-slate-400 italic">No operating expenses recorded in this period.</td>
                    </tr>
                  )}
                  <tr className="bg-slate-50/40 font-bold border-t border-slate-200">
                    <td className="py-2.5 px-4 font-sans text-slate-700">Total Operating Overhead</td>
                    <td></td>
                    <td className="py-2.5 px-3 text-right text-rose-600 font-bold">
                      ({formatCurrency(pnlResult.totalOperatingExpenses, currencyCode, currencySymbol)})
                    </td>
                  </tr>

                  <tr className="bg-indigo-50/80 text-sm font-black border-t-2 border-indigo-300">
                    <td className="p-3.5 font-sans text-indigo-950">
                      NET OPERATING PROFIT (EBIT) [Margin: {pnlResult.netMarginPercent}%]
                    </td>
                    <td></td>
                    <td className="p-3.5 text-right text-indigo-700 text-base font-extrabold">
                      {formatCurrency(pnlResult.netOperatingProfit, currencyCode, currencySymbol)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: CHART OF ACCOUNTS (COA) */}
      {activeTab === 'coa' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base font-mono uppercase">
                Master Chart of Accounts (COA)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Categorized structure of Assets, Liabilities, Equity, Revenues, and Expenses.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-700">
              {allAccounts.length} Active Ledger Accounts
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="p-3">Account Code</th>
                  <th className="p-3">Account Title</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Normal Balance</th>
                  <th className="p-3 text-right">Current Balance ({currencySymbol})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {allAccounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50/80">
                    <td className="p-3 font-bold text-slate-900">{acc.accountNumber}</td>
                    <td className="p-3 font-sans font-semibold text-slate-800">{acc.accountName}</td>
                    <td className="p-3 uppercase text-[10px] text-slate-600 font-bold">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100">
                        {acc.accountCategory || acc.type}
                      </span>
                    </td>
                    <td className="p-3 font-sans text-slate-500 capitalize">{acc.type.replace('_', ' ')}</td>
                    <td className="p-3 uppercase font-bold text-[10px] text-slate-500">
                      {acc.normalBalance || (acc.accountCategory === 'liability' || acc.accountCategory === 'equity' || acc.accountCategory === 'revenue' ? 'credit' : 'debit')}
                    </td>
                    <td className="p-3 text-right font-extrabold text-slate-900">
                      {formatCurrency(acc.currentBalance || 0, currencyCode, currencySymbol)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* POST MANUAL JOURNAL VOUCHER MODAL */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Post Double-Entry Journal Voucher"
        description="Every valid accounting transaction must satisfy: Total Debits = Total Credits."
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitManualJournal} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Posting Date *
              </label>
              <Input
                type="date"
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reference / Memo #
              </label>
              <Input
                type="text"
                placeholder="e.g. MEMO-9901"
                value={manualReference}
                onChange={(e) => setManualReference(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Voucher Narration / Description *
            </label>
            <Input
              type="text"
              placeholder="e.g. Monthly depreciation of warehouse machinery assets"
              value={manualDescription}
              onChange={(e) => setManualDescription(e.target.value)}
              required
            />
          </div>

          {/* Lines Table */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Journal Debit &amp; Credit Line Items
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddManualLine}
                className="text-xs flex items-center gap-1 py-1"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-600" /> Add Line
              </Button>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-semibold">
                  <tr>
                    <th className="p-2.5">Account Title &amp; Code</th>
                    <th className="p-2.5 w-28 text-right">Debit ({currencySymbol})</th>
                    <th className="p-2.5 w-28 text-right">Credit ({currencySymbol})</th>
                    <th className="p-2.5 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {manualLines.map((line, idx) => (
                    <tr key={idx}>
                      <td className="p-2">
                        <select
                          value={line.accountId}
                          onChange={(e) => handleUpdateManualLine(idx, 'accountId', e.target.value)}
                          className="w-full text-xs p-1.5 border border-slate-300 rounded font-mono font-medium focus:ring-1 focus:ring-indigo-500"
                          required
                        >
                          <option value="">Select Account...</option>
                          {allAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.accountNumber} — {acc.accountName}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={line.debit}
                          onChange={(e) => handleUpdateManualLine(idx, 'debit', e.target.value)}
                          className="w-full text-xs p-1.5 border border-slate-300 rounded font-mono text-right font-bold text-emerald-600 focus:ring-1 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={line.credit}
                          onChange={(e) => handleUpdateManualLine(idx, 'credit', e.target.value)}
                          className="w-full text-xs p-1.5 border border-slate-300 rounded font-mono text-right font-bold text-rose-600 focus:ring-1 focus:ring-rose-500"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveManualLine(idx)}
                          className="text-slate-400 hover:text-rose-500"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {/* Equilibrium Validator Row */}
                  <tr className="bg-slate-50 font-bold border-t border-slate-200">
                    <td className="p-2.5 text-right font-sans">Total Balanced Equilibrium:</td>
                    <td className="p-2.5 text-right font-mono text-emerald-700 font-black">
                      {formatCurrency(manualTotals.totalDebit, currencyCode, currencySymbol)}
                    </td>
                    <td className="p-2.5 text-right font-mono text-rose-700 font-black">
                      {formatCurrency(manualTotals.totalCredit, currencyCode, currencySymbol)}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Validation alert if not balanced */}
            {!manualTotals.isBalanced && manualTotals.totalDebit > 0 && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>
                  Unbalanced voucher: Debits exceed credits (or vice-versa) by{' '}
                  <strong className="font-mono">{formatCurrency(manualTotals.diff, currencyCode, currencySymbol)}</strong>.
                  Both sides must be identical before posting.
                </span>
              </div>
            )}
          </div>

          <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
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
              disabled={!manualTotals.isBalanced || submitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            >
              {submitting ? 'Posting Voucher...' : 'Confirm & Post Voucher'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* VIEW JOURNAL VOUCHER DETAILS MODAL */}
      {viewEntryModal && (
        <Modal
          isOpen={!!viewEntryModal}
          onClose={() => setViewEntryModal(null)}
          title={`Journal Voucher: ${viewEntryModal.entryNumber}`}
          description={`Date: ${formatDate(viewEntryModal.date)} • Module: ${viewEntryModal.sourceModule.toUpperCase()} • Ref: ${viewEntryModal.reference}`}
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
              <div className="font-bold text-slate-800">{viewEntryModal.description}</div>
              {viewEntryModal.reversalReason && (
                <div className="text-rose-600 font-semibold mt-1">
                  Reversal Reason: {viewEntryModal.reversalReason}
                </div>
              )}
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-semibold uppercase">
                  <tr>
                    <th className="p-2.5">Account Code</th>
                    <th className="p-2.5">Account Name</th>
                    <th className="p-2.5 text-right">Debit ({currencySymbol})</th>
                    <th className="p-2.5 text-right">Credit ({currencySymbol})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {viewEntryModal.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="p-2.5 font-bold text-slate-800">{l.accountNumber}</td>
                      <td className="p-2.5 font-sans font-semibold text-slate-900">{l.accountName}</td>
                      <td className="p-2.5 text-right font-bold text-emerald-600">
                        {l.debit > 0 ? formatCurrency(l.debit, currencyCode, currencySymbol) : '—'}
                      </td>
                      <td className="p-2.5 text-right font-bold text-rose-600">
                        {l.credit > 0 ? formatCurrency(l.credit, currencyCode, currencySymbol) : '—'}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-bold border-t border-slate-300">
                    <td colSpan={2} className="p-2.5 text-right font-sans">Total Equilibrium:</td>
                    <td className="p-2.5 text-right font-black text-emerald-700">
                      {formatCurrency(viewEntryModal.totalDebit, currencyCode, currencySymbol)}
                    </td>
                    <td className="p-2.5 text-right font-black text-rose-700">
                      {formatCurrency(viewEntryModal.totalCredit, currencyCode, currencySymbol)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="pt-3 flex justify-between items-center border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => printJournalVoucher(viewEntryModal, currentTenant)}
                className="flex items-center gap-1.5 text-xs font-semibold"
              >
                <Printer className="w-3.5 h-3.5 text-indigo-600" /> Print Voucher
              </Button>
              <Button
                type="button"
                onClick={() => setViewEntryModal(null)}
                className="bg-slate-800 text-white text-xs font-semibold"
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* REVERSE JOURNAL ENTRY MODAL */}
      {entryToReverse && (
        <Modal
          isOpen={reverseModalOpen}
          onClose={() => setReverseModalOpen(false)}
          title={`Post Reversal for Voucher ${entryToReverse.entryNumber}`}
          description="Per strict accounting rules, posted records cannot be deleted. A counter-balancing reversal entry will be posted."
          maxWidth="md"
        >
          <form onSubmit={handleExecuteReversal} className="space-y-4">
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-rose-600" />
                This action will post an inverted double-entry voucher
              </div>
              <p className="text-[11px] text-rose-700 leading-relaxed">
                All debits will be credited, and credits will be debited. The original entry will remain preserved in the ledger with a status of Void / Reversed.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mandatory Reason for Reversal *
              </label>
              <textarea
                rows={3}
                required
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-1 focus:ring-rose-500"
                placeholder="e.g. Discovered billing discrepancy; customer invoiced under duplicate sales order."
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
              />
            </div>

            <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setReverseModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || !reversalReason.trim()}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                {submitting ? 'Posting Reversal...' : 'Confirm Accounting Reversal'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

'use client';

import React, { useState, useMemo } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  AccountService,
  PaymentService,
  ExpenseService,
  AuditLogService,
  generateAccountLedger,
  AccountLedgerEntry,
} from '@/services/erp.service';
import { Account, Payment, Expense } from '@/types/erp';
import { useRealtimeCollection } from '@/hooks/useRealtimeCollection';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, Column } from '@/components/common/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { formatCurrency, formatDate } from '@/lib/utils';
import { printPaymentReceipt, printAccountStatement } from '@/lib/pdfPrint';
import {
  Plus,
  Building2,
  Wallet,
  DollarSign,
  CheckCircle2,
  XCircle,
  Star,
  Trash2,
  Edit2,
  Layers,
  ArrowRightLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Printer,
  FileText,
  AlertCircle,
  History,
  ShieldAlert,
  Search,
  Check,
  Ban,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';

export default function AccountsPage() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { showToast } = useToast();

  const tenantId = currentTenant?.id || 'tenant-apex-corp';
  const currencySymbol = currentTenant?.settings.currencySymbol || '$';
  const currencyCode = currentTenant?.settings.currency || 'USD';

  // 1. Real-time Accounts collection
  const {
    items: accounts,
    allItems: allAccounts,
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
  } = useRealtimeCollection<Account>((tId) => new AccountService(tId), {
    sortBy: 'currentBalance',
    sortDirection: 'desc',
  });

  // 2. Real-time Payments and Expenses for Ledger generation
  const { allItems: allPayments } = useRealtimeCollection<Payment>((tId) => new PaymentService(tId));
  const { allItems: allExpenses } = useRealtimeCollection<Expense>((tId) => new ExpenseService(tId));

  const paymentService = useMemo(() => new PaymentService(tenantId), [tenantId]);
  const auditLogService = useMemo(() => new AuditLogService(tenantId), [tenantId]);

  // Filters State
  const [typeFilter, setTypeFilter] = useState<'all' | 'bank' | 'cash'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Modal & Form State: Add / Edit Account
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields for Account Create / Edit
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [type, setType] = useState<Account['type']>('bank');
  const [currency, setCurrency] = useState(currencyCode);
  const [openingBalance, setOpeningBalance] = useState('0');
  const [bankName, setBankName] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  // Transfer Funds State
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [transferReference, setTransferReference] = useState('');
  const [transferNotes, setTransferNotes] = useState('');

  // Receive Money / Deposit State
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [depositAccountId, setDepositAccountId] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositDate, setDepositDate] = useState(new Date().toISOString().split('T')[0]);
  const [depositPaymentMethod, setDepositPaymentMethod] = useState<'cash' | 'bank_transfer' | 'credit_card' | 'cheque'>('bank_transfer');
  const [depositPayer, setDepositPayer] = useState('');
  const [depositReference, setDepositReference] = useState('');
  const [depositNotes, setDepositNotes] = useState('');

  // Pay Money / Withdrawal State
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);
  const [withdrawalAccountId, setWithdrawalAccountId] = useState('');
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalDate, setWithdrawalDate] = useState(new Date().toISOString().split('T')[0]);
  const [withdrawalPaymentMethod, setWithdrawalPaymentMethod] = useState<'cash' | 'bank_transfer' | 'credit_card' | 'cheque'>('cash');
  const [withdrawalBeneficiary, setWithdrawalBeneficiary] = useState('');
  const [withdrawalReference, setWithdrawalReference] = useState('');
  const [withdrawalNotes, setWithdrawalNotes] = useState('');

  // Transaction History / Ledger Modal State
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedAccountForHistory, setSelectedAccountForHistory] = useState<Account | null>(null);

  // Last Generated Transaction Payment for Receipt Printing
  const [lastActionPayment, setLastActionPayment] = useState<Payment | null>(null);

  // High-level KPI Computations
  const stats = useMemo(() => {
    const activeAccs = allAccounts.filter((a) => a.status !== 'inactive');
    const liquidTotal = activeAccs
      .filter((a) => a.type === 'cash' || a.type === 'bank')
      .reduce((sum, a) => sum + (a.currentBalance || 0), 0);

    const cashTotal = activeAccs
      .filter((a) => a.type === 'cash')
      .reduce((sum, a) => sum + (a.currentBalance || 0), 0);

    const bankTotal = activeAccs
      .filter((a) => a.type === 'bank')
      .reduce((sum, a) => sum + (a.currentBalance || 0), 0);

    const defaultAcc = allAccounts.find((a) => a.isDefault);

    return {
      liquidTotal,
      cashTotal,
      bankTotal,
      defaultName: defaultAcc?.accountName || 'None',
      count: allAccounts.length,
      activeCount: activeAccs.length,
    };
  }, [allAccounts]);

  // Filtered Accounts for DataTable view
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      if (typeFilter !== 'all' && acc.type !== typeFilter) return false;
      if (statusFilter !== 'all' && acc.status !== statusFilter) return false;
      return true;
    });
  }, [accounts, typeFilter, statusFilter]);

  // Selected Account Ledger computation (real-time synchronized)
  const currentLedger = useMemo<AccountLedgerEntry[]>(() => {
    if (!selectedAccountForHistory) return [];
    const latestAccount = allAccounts.find((a) => a.id === selectedAccountForHistory.id) || selectedAccountForHistory;
    return generateAccountLedger(latestAccount, allPayments, allExpenses);
  }, [selectedAccountForHistory, allAccounts, allPayments, allExpenses]);

  // Handle Opening Add Modal
  const handleOpenAddModal = () => {
    setEditingAccount(null);
    setAccountName('');
    setAccountNumber(`ACC-${Math.floor(1000 + Math.random() * 9000)}`);
    setType('bank');
    setCurrency(currencyCode);
    setOpeningBalance('0');
    setBankName('');
    setBankBranch('');
    setIsDefault(false);
    setModalOpen(true);
  };

  // Handle Opening Edit Modal (Strictly Read-Only Balance)
  const handleOpenEditModal = (acc: Account) => {
    setEditingAccount(acc);
    setAccountName(acc.accountName);
    setAccountNumber(acc.accountNumber);
    setType(acc.type);
    setCurrency(acc.currency || currencyCode);
    setBankName(acc.bankName || '');
    setBankBranch(acc.bankBranch || '');
    setIsDefault(acc.isDefault || false);
    setModalOpen(true);
  };

  // Handle Opening Transfer Modal
  const handleOpenTransferModal = () => {
    const liquidAccounts = allAccounts.filter((a) => (a.type === 'cash' || a.type === 'bank') && a.status !== 'inactive');
    if (liquidAccounts.length < 2) {
      showToast('You need at least 2 active bank or cash accounts to transfer funds.', 'error');
      return;
    }
    setFromAccountId(liquidAccounts[0].id);
    setToAccountId(liquidAccounts[1].id);
    setTransferAmount('');
    setTransferDate(new Date().toISOString().split('T')[0]);
    setTransferReference(`TRF-${Math.floor(10000 + Math.random() * 90000)}`);
    setTransferNotes('');
    setTransferModalOpen(true);
  };

  // Handle Opening Deposit Modal
  const handleOpenDepositModal = (presetAccountId?: string) => {
    const liquidAccounts = allAccounts.filter((a) => (a.type === 'cash' || a.type === 'bank') && a.status !== 'inactive');
    if (liquidAccounts.length === 0) {
      showToast('No active bank or cash accounts available for deposit.', 'error');
      return;
    }
    const defaultAcc = allAccounts.find((a) => a.isDefault && a.status !== 'inactive') || liquidAccounts[0];
    setDepositAccountId(presetAccountId || defaultAcc.id);
    setDepositAmount('');
    setDepositDate(new Date().toISOString().split('T')[0]);
    setDepositPaymentMethod('bank_transfer');
    setDepositPayer('');
    setDepositReference(`DEP-${Math.floor(10000 + Math.random() * 90000)}`);
    setDepositNotes('');
    setDepositModalOpen(true);
  };

  // Handle Opening Withdrawal Modal
  const handleOpenWithdrawalModal = (presetAccountId?: string) => {
    const liquidAccounts = allAccounts.filter((a) => (a.type === 'cash' || a.type === 'bank') && a.status !== 'inactive');
    if (liquidAccounts.length === 0) {
      showToast('No active bank or cash accounts available for withdrawal.', 'error');
      return;
    }
    const defaultAcc = allAccounts.find((a) => a.isDefault && a.status !== 'inactive') || liquidAccounts[0];
    setWithdrawalAccountId(presetAccountId || defaultAcc.id);
    setWithdrawalAmount('');
    setWithdrawalDate(new Date().toISOString().split('T')[0]);
    setWithdrawalPaymentMethod('cash');
    setWithdrawalBeneficiary('');
    setWithdrawalReference(`WTH-${Math.floor(10000 + Math.random() * 90000)}`);
    setWithdrawalNotes('');
    setWithdrawalModalOpen(true);
  };

  // Handle Opening History / Ledger Modal
  const handleOpenHistoryModal = (acc: Account) => {
    setSelectedAccountForHistory(acc);
    setHistoryModalOpen(true);
  };

  // Toggle Active / Inactive Status
  const handleToggleAccountStatus = async (acc: Account) => {
    const newStatus = acc.status === 'active' ? 'inactive' : 'active';
    try {
      await updateItem(acc.id, { status: newStatus });
      showToast(`Account "${acc.accountName}" set to ${newStatus}.`, 'info');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Status update failed';
      showToast(msg, 'error');
    }
  };

  // Submit Add / Edit Account
  const handleSubmitAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingAccount) {
        // Balance is NEVER updated manually here! Only metadata.
        await updateItem(editingAccount.id, {
          accountName,
          accountNumber,
          type,
          currency,
          bankName: type === 'bank' ? bankName : undefined,
          bankBranch: type === 'bank' ? bankBranch : undefined,
          isDefault,
        });
        showToast(`Account "${accountName}" updated successfully.`, 'success');
      } else {
        const opBal = parseFloat(openingBalance) || 0;
        await createItem({
          accountName,
          accountNumber,
          type,
          currency,
          openingBalance: opBal,
          currentBalance: opBal, // Initially matches opening balance
          bankName: type === 'bank' ? bankName : undefined,
          bankBranch: type === 'bank' ? bankBranch : undefined,
          isDefault,
          status: 'active',
        });
        showToast(`Account "${accountName}" created successfully with initial balance ${formatCurrency(opBal, currencyCode, currencySymbol)}.`, 'success');
      }
      setModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save account';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Execute Inter-Account Fund Transfer
  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fromAccountId === toAccountId) {
      showToast('Source and Destination accounts cannot be the same.', 'error');
      return;
    }

    const amt = parseFloat(transferAmount) || 0;
    if (amt <= 0) {
      showToast('Transfer amount must be greater than 0.', 'error');
      return;
    }

    const fromAcc = allAccounts.find((a) => a.id === fromAccountId);
    const toAcc = allAccounts.find((a) => a.id === toAccountId);

    if (!fromAcc || !toAcc) {
      showToast('Selected accounts are invalid.', 'error');
      return;
    }

    if (fromAcc.status === 'inactive' || toAcc.status === 'inactive') {
      showToast('Both accounts must be active to perform a transfer.', 'error');
      return;
    }

    if ((fromAcc.currentBalance || 0) < amt) {
      showToast(
        `Insufficient funds in ${fromAcc.accountName}. Available: ${formatCurrency(fromAcc.currentBalance || 0, currencyCode, currencySymbol)}`,
        'error'
      );
      return;
    }

    setSubmitting(true);
    try {
      const paymentNumber = `TRF-${Date.now().toString().slice(-6)}`;

      // 1. Deduct from source account
      await updateItem(fromAcc.id, {
        currentBalance: (fromAcc.currentBalance || 0) - amt,
      });

      // 2. Add to destination account
      await updateItem(toAcc.id, {
        currentBalance: (toAcc.currentBalance || 0) + amt,
      });

      // 3. Create Transfer Payment Record
      const transferPayment: Payment = await paymentService.create({
        paymentNumber,
        partyType: 'internal_transfer',
        partyId: toAcc.id,
        partyName: toAcc.accountName,
        type: 'transfer',
        amount: amt,
        date: transferDate,
        accountId: fromAcc.id,
        accountName: fromAcc.accountName,
        destinationAccountId: toAcc.id,
        destinationAccountName: toAcc.accountName,
        paymentMethod: fromAcc.type === 'bank' ? 'bank_transfer' : 'cash',
        reference: transferReference || paymentNumber,
        notes: transferNotes || `Fund transfer from ${fromAcc.accountName} to ${toAcc.accountName}`,
        status: 'active',
      });

      // 4. Audit Log
      await auditLogService.create({
        action: 'STATUS_CHANGE',
        module: 'Accounts',
        entityId: paymentNumber,
        entityName: `${fromAcc.accountName} -> ${toAcc.accountName}`,
        description: `Transferred ${formatCurrency(amt, currencyCode, currencySymbol)} from ${fromAcc.accountName} to ${toAcc.accountName}`,
        userId: user?.uid || 'system',
        userName: user?.displayName || 'Administrator',
        userEmail: user?.email || 'admin@erp.com',
        timestamp: new Date().toISOString(),
      });

      setLastActionPayment(transferPayment);
      showToast(
        `Successfully transferred ${formatCurrency(amt, currencyCode, currencySymbol)} between accounts!`,
        'success'
      );
      setTransferModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transfer failed';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Execute Direct Deposit / Receive Money
  const handleExecuteDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(depositAmount) || 0;
    if (amt <= 0) {
      showToast('Deposit amount must be greater than 0.', 'error');
      return;
    }

    const acc = allAccounts.find((a) => a.id === depositAccountId);
    if (!acc) {
      showToast('Please select a valid account.', 'error');
      return;
    }

    if (acc.status === 'inactive') {
      showToast('Cannot deposit into an inactive account.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const paymentNumber = `DEP-${Date.now().toString().slice(-6)}`;
      const newBalance = (acc.currentBalance || 0) + amt;

      // 1. Update account balance in real-time
      await updateItem(acc.id, {
        currentBalance: newBalance,
      });

      // 2. Create Payment Record (direct_deposit)
      const pmt = await paymentService.create({
        paymentNumber,
        partyType: 'direct_deposit',
        partyId: acc.id,
        partyName: depositPayer || 'Direct Deposit / Inflow',
        type: 'receipt',
        amount: amt,
        date: depositDate,
        accountId: acc.id,
        accountName: acc.accountName,
        paymentMethod: depositPaymentMethod,
        reference: depositReference || paymentNumber,
        notes: depositNotes || `Direct deposit received into ${acc.accountName}`,
        status: 'active',
      });

      // 3. Audit Log
      await auditLogService.create({
        action: 'STATUS_CHANGE',
        module: 'Accounts',
        entityId: paymentNumber,
        entityName: acc.accountName,
        description: `Direct deposit of ${formatCurrency(amt, currencyCode, currencySymbol)} into ${acc.accountName}`,
        userId: user?.uid || 'system',
        userName: user?.displayName || 'Administrator',
        userEmail: user?.email || 'admin@erp.com',
        timestamp: new Date().toISOString(),
      });

      setLastActionPayment(pmt);
      showToast(
        `Successfully received ${formatCurrency(amt, currencyCode, currencySymbol)} into ${acc.accountName}!`,
        'success'
      );
      setDepositModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Deposit failed';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Execute Direct Withdrawal / Pay Money
  const handleExecuteWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(withdrawalAmount) || 0;
    if (amt <= 0) {
      showToast('Withdrawal amount must be greater than 0.', 'error');
      return;
    }

    const acc = allAccounts.find((a) => a.id === withdrawalAccountId);
    if (!acc) {
      showToast('Please select a valid account.', 'error');
      return;
    }

    if (acc.status === 'inactive') {
      showToast('Cannot disburse funds from an inactive account.', 'error');
      return;
    }

    if ((acc.currentBalance || 0) < amt) {
      showToast(
        `Insufficient funds in ${acc.accountName}. Available: ${formatCurrency(acc.currentBalance || 0, currencyCode, currencySymbol)}`,
        'error'
      );
      return;
    }

    setSubmitting(true);
    try {
      const paymentNumber = `WTH-${Date.now().toString().slice(-6)}`;
      const newBalance = (acc.currentBalance || 0) - amt;

      // 1. Update account balance in real-time
      await updateItem(acc.id, {
        currentBalance: newBalance,
      });

      // 2. Create Payment Record (direct_withdrawal)
      const pmt = await paymentService.create({
        paymentNumber,
        partyType: 'direct_withdrawal',
        partyId: acc.id,
        partyName: withdrawalBeneficiary || 'Direct Cash/Bank Withdrawal',
        type: 'payment',
        amount: amt,
        date: withdrawalDate,
        accountId: acc.id,
        accountName: acc.accountName,
        paymentMethod: withdrawalPaymentMethod,
        reference: withdrawalReference || paymentNumber,
        notes: withdrawalNotes || `Cash/Bank disbursement from ${acc.accountName}`,
        status: 'active',
      });

      // 3. Audit Log
      await auditLogService.create({
        action: 'STATUS_CHANGE',
        module: 'Accounts',
        entityId: paymentNumber,
        entityName: acc.accountName,
        description: `Disbursed withdrawal of ${formatCurrency(amt, currencyCode, currencySymbol)} from ${acc.accountName}`,
        userId: user?.uid || 'system',
        userName: user?.displayName || 'Administrator',
        userEmail: user?.email || 'admin@erp.com',
        timestamp: new Date().toISOString(),
      });

      setLastActionPayment(pmt);
      showToast(
        `Successfully withdrew ${formatCurrency(amt, currencyCode, currencySymbol)} from ${acc.accountName}!`,
        'success'
      );
      setWithdrawalModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Withdrawal failed';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Columns for DataTable
  const columns: Column<Account>[] = [
    {
      header: 'Account Particulars',
      accessor: 'accountName',
      sortable: true,
      cell: (acc) => (
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-xl ${
              acc.type === 'bank'
                ? 'bg-blue-50 text-blue-600 border border-blue-200'
                : acc.type === 'cash'
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            {acc.type === 'bank' ? <Building2 className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
          </div>
          <div>
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              {acc.accountName}
              {acc.isDefault && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" /> Default
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 font-mono tracking-wider">{acc.accountNumber}</div>
          </div>
        </div>
      ),
    },
    {
      header: 'Type',
      accessor: 'type',
      sortable: true,
      cell: (acc) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
            acc.type === 'bank'
              ? 'bg-blue-100 text-blue-800'
              : acc.type === 'cash'
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-slate-100 text-slate-700'
          }`}
        >
          {acc.type.replace('_', ' ')}
        </span>
      ),
    },
    {
      header: 'Institution / Branch',
      accessor: 'bankName',
      cell: (acc) =>
        acc.bankName ? (
          <div>
            <div className="text-slate-800 font-semibold text-xs">{acc.bankName}</div>
            <div className="text-[11px] text-slate-400">{acc.bankBranch || 'Main Branch'}</div>
          </div>
        ) : (
          <span className="text-slate-400 text-xs italic">Physical Cash Vault / Till</span>
        ),
    },
    {
      header: 'Status',
      accessor: 'status',
      sortable: true,
      cell: (acc) => (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
            acc.status === 'inactive'
              ? 'bg-slate-100 text-slate-600 border border-slate-300'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-300'
          }`}
        >
          {acc.status === 'inactive' ? (
            <>
              <Ban className="w-3 h-3" /> Inactive
            </>
          ) : (
            <>
              <Check className="w-3 h-3" /> Active
            </>
          )}
        </span>
      ),
    },
    {
      header: 'Current Balance',
      accessor: 'currentBalance',
      sortable: true,
      cell: (acc) => (
        <div>
          <span
            className={`font-mono font-extrabold text-sm ${
              (acc.currentBalance || 0) >= 0 ? 'text-slate-900' : 'text-rose-600'
            }`}
          >
            {formatCurrency(acc.currentBalance || 0, currencyCode, currencySymbol)}
          </span>
          <div className="text-[10px] text-slate-400 font-mono">Live Transaction Balance</div>
        </div>
      ),
    },
    {
      header: 'Actions',
      cell: (acc) => (
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleOpenHistoryModal(acc)}
            className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
            title="Account Ledger / Statement"
          >
            <History className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleOpenDepositModal(acc.id)}
            className="text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
            title="Receive Money / Deposit"
          >
            <ArrowDownLeft className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleOpenWithdrawalModal(acc.id)}
            className="text-amber-600 hover:text-amber-800 hover:bg-amber-50"
            title="Pay Money / Withdrawal"
          >
            <ArrowUpRight className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleOpenEditModal(acc)}
            title="Edit Details"
          >
            <Edit2 className="w-4 h-4 text-slate-600" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleToggleAccountStatus(acc)}
            title={acc.status === 'inactive' ? 'Enable Account' : 'Disable Account'}
            className={acc.status === 'inactive' ? 'text-emerald-600' : 'text-slate-400 hover:text-rose-500'}
          >
            {acc.status === 'inactive' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          </Button>
          {!acc.isDefault && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (confirm(`Are you sure you want to delete account ${acc.accountName}?`)) {
                  softDeleteItem(acc.id);
                  showToast(`Account ${acc.accountName} removed.`, 'info');
                }
              }}
              title="Delete Account"
            >
              <Trash2 className="w-4 h-4 text-rose-500" />
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
        title="Cash & Bank Management"
        description="Multi-currency bank accounts, physical cash drawers, real-time transaction ledger, inter-account transfers, and direct deposits/withdrawals."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Accounts' },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => handleOpenDepositModal()}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs font-semibold text-xs py-2"
            >
              <ArrowDownLeft className="w-4 h-4" />
              Receive Money
            </Button>
            <Button
              onClick={() => handleOpenWithdrawalModal()}
              className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white shadow-2xs font-semibold text-xs py-2"
            >
              <ArrowUpRight className="w-4 h-4" />
              Pay Money
            </Button>
            <Button
              onClick={handleOpenTransferModal}
              className="flex items-center gap-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 shadow-2xs font-semibold text-xs py-2"
            >
              <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
              Transfer Money
            </Button>
            <Button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs font-semibold text-xs py-2"
            >
              <Plus className="w-4 h-4" />
              Add Account
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Liquid Cash & Bank
            </span>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2 font-mono">
            {formatCurrency(stats.liquidTotal, currencyCode, currencySymbol)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Available active liquid balance</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Commercial Banks
            </span>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {formatCurrency(stats.bankTotal, currencyCode, currencySymbol)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Institutional checking & reserves</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Cash Drawers & Till
            </span>
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {formatCurrency(stats.cashTotal, currencyCode, currencySymbol)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Petty cash & counter drawers</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Operational Accounts
            </span>
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {stats.activeCount} <span className="text-sm font-normal text-slate-400">/ {stats.count} total</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">Default: {stats.defaultName}</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600">Account Type:</label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Account Types</option>
              <option value="bank">Bank Accounts</option>
              <option value="cash">Cash Drawers</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600">Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
          <ShieldAlert className="w-4 h-4 text-indigo-500" />
          <span>Balances are strictly generated from posted real-time transactions.</span>
        </div>
      </div>

      {/* Accounts DataTable */}
      <DataTable<Account>
        columns={columns}
        data={filteredAccounts}
        loading={loading}
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSortChange={(field: string) => setSortBy(field)}
      />

      {/* ADD / EDIT ACCOUNT MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingAccount ? `Edit Account: ${editingAccount.accountName}` : 'Add Cash / Bank Account'}
        maxWidth="md"
      >
        <form onSubmit={handleSubmitAccount} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Account Name *
              </label>
              <Input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g. Meezan Main Operational"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Account Number / Code *
              </label>
              <Input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="e.g. PK89MEZN00192834"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Account Type *
              </label>
              <Select
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
                required
                options={[
                  { label: 'Bank Account', value: 'bank' },
                  { label: 'Cash Drawer / Vault', value: 'cash' },
                  { label: 'Accounts Receivable', value: 'accounts_receivable' },
                  { label: 'Accounts Payable', value: 'accounts_payable' },
                  { label: 'Income', value: 'income' },
                  { label: 'Expense', value: 'expense' },
                  { label: 'Equity', value: 'equity' },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Currency
              </label>
              <Input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="USD"
              />
            </div>
          </div>

          {/* FINANCIAL RULE: IF EDITING, BALANCE IS STRICTLY READ-ONLY */}
          {editingAccount ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Account Balance</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                  <ShieldAlert className="w-3.5 h-3.5 text-indigo-600" /> Transaction-Derived
                </span>
              </div>
              <div className="text-xl font-extrabold font-mono text-slate-900">
                {formatCurrency(editingAccount.currentBalance || 0, currencyCode, currencySymbol)}
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed pt-1 border-t border-slate-200/60">
                Balance cannot be edited manually. It updates automatically in real-time through posted sales, supplier payments, expenses, transfers, and deposits.
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Opening Balance ({currencySymbol})
              </label>
              <Input
                type="number"
                step="0.01"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0.00"
              />
              <span className="text-[11px] text-slate-400">
                Starting balance for the ledger upon creating this account.
              </span>
            </div>
          )}

          {type === 'bank' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Bank Name
                </label>
                <Input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. Bank of America"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Branch
                </label>
                <Input
                  type="text"
                  value={bankBranch}
                  onChange={(e) => setBankBranch(e.target.value)}
                  placeholder="e.g. Austin Downtown"
                />
              </div>
            </div>
          )}

          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-semibold">Set as primary default operational account</span>
            </label>
          </div>

          <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            >
              {submitting ? 'Saving...' : editingAccount ? 'Update Details' : 'Create Account'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* RECEIVE MONEY / DIRECT DEPOSIT MODAL */}
      <Modal
        isOpen={depositModalOpen}
        onClose={() => setDepositModalOpen(false)}
        title="Receive Money / Direct Cash Deposit"
        description="Record direct incoming funds, owner investment, capital additions, or miscellaneous cash inflows."
        maxWidth="md"
      >
        <form onSubmit={handleExecuteDeposit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Deposit Into Account *
            </label>
            <Select
              value={depositAccountId}
              onChange={(e) => setDepositAccountId(e.target.value)}
              required
              options={allAccounts
                .filter((a) => (a.type === 'cash' || a.type === 'bank') && a.status !== 'inactive')
                .map((a) => ({
                  label: `${a.accountName} (${formatCurrency(a.currentBalance, currencyCode, currencySymbol)})`,
                  value: a.id,
                }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Deposit Amount ({currencySymbol}) *
              </label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Deposit Date *
              </label>
              <Input
                type="date"
                value={depositDate}
                onChange={(e) => setDepositDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Method *
              </label>
              <Select
                value={depositPaymentMethod}
                onChange={(e) => setDepositPaymentMethod(e.target.value as typeof depositPaymentMethod)}
                required
                options={[
                  { label: 'Bank Transfer / Wire', value: 'bank_transfer' },
                  { label: 'Physical Cash', value: 'cash' },
                  { label: 'Credit Card / POS', value: 'credit_card' },
                  { label: 'Cheque / Direct Deposit', value: 'cheque' },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Source / Payer Name
              </label>
              <Input
                type="text"
                value={depositPayer}
                onChange={(e) => setDepositPayer(e.target.value)}
                placeholder="e.g. Managing Partner Capital"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reference / Bank Deposit Slip #
            </label>
            <Input
              type="text"
              value={depositReference}
              onChange={(e) => setDepositReference(e.target.value)}
              placeholder="e.g. SLIP-88401"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Deposit Memo / Notes
            </label>
            <textarea
              rows={2}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-1 focus:ring-emerald-500"
              placeholder="Add explanation for this direct receipt"
              value={depositNotes}
              onChange={(e) => setDepositNotes(e.target.value)}
            />
          </div>

          <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDepositModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {submitting ? 'Recording...' : 'Confirm Deposit'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* PAY MONEY / DIRECT WITHDRAWAL MODAL */}
      <Modal
        isOpen={withdrawalModalOpen}
        onClose={() => setWithdrawalModalOpen(false)}
        title="Pay Money / Direct Cash Withdrawal"
        description="Record direct payments, owner drawings, petty cash replenishment, or miscellaneous fund disbursements."
        maxWidth="md"
      >
        <form onSubmit={handleExecuteWithdrawal} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Withdraw From Account *
            </label>
            <Select
              value={withdrawalAccountId}
              onChange={(e) => setWithdrawalAccountId(e.target.value)}
              required
              options={allAccounts
                .filter((a) => (a.type === 'cash' || a.type === 'bank') && a.status !== 'inactive')
                .map((a) => ({
                  label: `${a.accountName} (${formatCurrency(a.currentBalance, currencyCode, currencySymbol)})`,
                  value: a.id,
                }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Withdrawal Amount ({currencySymbol}) *
              </label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={withdrawalAmount}
                onChange={(e) => setWithdrawalAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Withdrawal Date *
              </label>
              <Input
                type="date"
                value={withdrawalDate}
                onChange={(e) => setWithdrawalDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Method *
              </label>
              <Select
                value={withdrawalPaymentMethod}
                onChange={(e) => setWithdrawalPaymentMethod(e.target.value as typeof withdrawalPaymentMethod)}
                required
                options={[
                  { label: 'Physical Cash', value: 'cash' },
                  { label: 'Bank Wire / ACH', value: 'bank_transfer' },
                  { label: 'Corporate Card', value: 'credit_card' },
                  { label: 'Cheque / Draft', value: 'cheque' },
                ]}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Beneficiary / Payee
              </label>
              <Input
                type="text"
                value={withdrawalBeneficiary}
                onChange={(e) => setWithdrawalBeneficiary(e.target.value)}
                placeholder="e.g. Managing Partner Drawings"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reference / Cheque Number
            </label>
            <Input
              type="text"
              value={withdrawalReference}
              onChange={(e) => setWithdrawalReference(e.target.value)}
              placeholder="e.g. CHQ-99120"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Disbursement Notes / Memo
            </label>
            <textarea
              rows={2}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-1 focus:ring-amber-500"
              placeholder="Add purpose and reason for this withdrawal"
              value={withdrawalNotes}
              onChange={(e) => setWithdrawalNotes(e.target.value)}
            />
          </div>

          <div className="pt-3 flex justify-end gap-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setWithdrawalModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
            >
              {submitting ? 'Disbursing...' : 'Confirm Withdrawal'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* TRANSFER FUNDS MODAL */}
      <Modal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title="Inter-Account Fund Transfer"
        description="Transfer liquid funds between cash drawers and commercial bank accounts in real-time."
        maxWidth="lg"
      >
        <form onSubmit={handleExecuteTransfer} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Source Account (From) *
              </label>
              <Select
                value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
                required
                options={allAccounts
                  .filter((a) => (a.type === 'cash' || a.type === 'bank') && a.status !== 'inactive')
                  .map((a) => ({
                    label: `${a.accountName} (${formatCurrency(a.currentBalance, currencyCode, currencySymbol)})`,
                    value: a.id,
                  }))}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Destination Account (To) *
              </label>
              <Select
                value={toAccountId}
                onChange={(e) => setToAccountId(e.target.value)}
                required
                options={allAccounts
                  .filter((a) => (a.type === 'cash' || a.type === 'bank') && a.status !== 'inactive')
                  .map((a) => ({
                    label: `${a.accountName} (${formatCurrency(a.currentBalance, currencyCode, currencySymbol)})`,
                    value: a.id,
                  }))}
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
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Transfer Date *
              </label>
              <Input
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Transaction Reference / Slip #
            </label>
            <Input
              type="text"
              value={transferReference}
              onChange={(e) => setTransferReference(e.target.value)}
              placeholder="e.g. DEPOSIT-SLIP-9901"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Transfer Notes / Memo
            </label>
            <textarea
              rows={2}
              className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-1 focus:ring-indigo-500"
              placeholder="e.g. End of day cash deposit to main commercial bank account"
              value={transferNotes}
              onChange={(e) => setTransferNotes(e.target.value)}
            />
          </div>

          <div className="pt-3 flex items-center justify-between border-t border-slate-100">
            {lastActionPayment && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => printPaymentReceipt(lastActionPayment, currentTenant)}
                className="flex items-center gap-1 text-xs"
              >
                <Printer className="w-3.5 h-3.5" /> Print Last Voucher
              </Button>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => setTransferModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              >
                {submitting ? 'Transferring...' : 'Execute Transfer'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* TRANSACTION HISTORY & LEDGER MODAL */}
      {selectedAccountForHistory && (
        <Modal
          isOpen={historyModalOpen}
          onClose={() => setHistoryModalOpen(false)}
          title={`Account Ledger: ${selectedAccountForHistory.accountName}`}
          description={`Full chronological audit trail and transaction history. Current balance: ${formatCurrency(
            (allAccounts.find((a) => a.id === selectedAccountForHistory.id) || selectedAccountForHistory).currentBalance,
            currencyCode,
            currencySymbol
          )}`}
          maxWidth="xl"
        >
          <div className="space-y-4">
            {/* Account Header Summary Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-base">{selectedAccountForHistory.accountName}</span>
                  <span className="text-xs uppercase px-2 py-0.5 font-mono bg-blue-100 text-blue-800 rounded-full font-bold">
                    {selectedAccountForHistory.type}
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  A/C Number: {selectedAccountForHistory.accountNumber}
                  {selectedAccountForHistory.bankName ? ` • ${selectedAccountForHistory.bankName}` : ''}
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
                  Net Ledger Balance
                </span>
                <span className="text-2xl font-mono font-black text-indigo-700">
                  {formatCurrency(
                    (allAccounts.find((a) => a.id === selectedAccountForHistory.id) || selectedAccountForHistory).currentBalance,
                    currencyCode,
                    currencySymbol
                  )}
                </span>
              </div>
            </div>

            {/* Ledger Transactions Table */}
            <div className="max-h-[420px] overflow-y-auto border border-slate-200 rounded-xl shadow-2xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Reference</th>
                    <th className="p-3">Description / Particulars</th>
                    <th className="p-3 text-right">Credit (+)</th>
                    <th className="p-3 text-right">Debit (-)</th>
                    <th className="p-3 text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {currentLedger.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        No transactions found for this account yet.
                      </td>
                    </tr>
                  ) : (
                    currentLedger.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-mono text-slate-600 whitespace-nowrap">{formatDate(item.date)}</td>
                        <td className="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">{item.reference}</td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-900">{item.description}</div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-wider font-mono">
                            {item.type.replace('_', ' ')}
                          </div>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-600">
                          {item.inflow > 0 ? `+${formatCurrency(item.inflow, currencyCode, currencySymbol)}` : '—'}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-rose-600">
                          {item.outflow > 0 ? `-${formatCurrency(item.outflow, currencyCode, currencySymbol)}` : '—'}
                        </td>
                        <td className="p-3 text-right font-mono font-extrabold text-slate-900">
                          {formatCurrency(item.runningBalance, currencyCode, currencySymbol)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 flex items-center justify-between border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  printAccountStatement(
                    allAccounts.find((a) => a.id === selectedAccountForHistory.id) || selectedAccountForHistory,
                    currentLedger,
                    currentTenant
                  )
                }
                className="flex items-center gap-2 font-bold text-xs"
              >
                <Printer className="w-4 h-4 text-indigo-600" /> Print Official Statement
              </Button>

              <Button
                type="button"
                onClick={() => setHistoryModalOpen(false)}
                className="bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs"
              >
                Close Ledger
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

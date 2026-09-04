'use client';

import React, { useState, useMemo } from 'react';
import { useTenant } from '@/context/TenantContext';
import { PageHeader } from '@/components/common/PageHeader';
import { useRealtimeCollection } from '@/hooks/useRealtimeCollection';
import {
  SaleService,
  PurchaseService,
  ExpenseService,
  AccountService,
  CustomerService,
  SupplierService,
  ProductService,
  AuditLogService,
  StockTransactionService,
  calculateProductCurrentStock,
} from '@/services/erp.service';
import {
  DollarSign,
  ShoppingCart,
  Receipt,
  TrendingUp,
  Wallet,
  Building2,
  Users,
  Truck,
  Package,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Activity,
  Filter,
  Plus,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { StatusBadge } from '@/components/common/StatusBadge';

type DateFilterType = 'all' | 'today' | 'this_week' | 'this_month' | 'custom';

export default function DashboardOverviewPage() {
  const { currentTenant, userRole } = useTenant();

  // Date Filter State
  const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Real-time collections strictly partitioned by tenantId
  const { allItems: sales, loading: salesLoading } = useRealtimeCollection(
    (tenantId) => new SaleService(tenantId)
  );
  const { allItems: purchases, loading: purchasesLoading } = useRealtimeCollection(
    (tenantId) => new PurchaseService(tenantId)
  );
  const { allItems: expenses, loading: expensesLoading } = useRealtimeCollection(
    (tenantId) => new ExpenseService(tenantId)
  );
  const { allItems: accounts, loading: accountsLoading } = useRealtimeCollection(
    (tenantId) => new AccountService(tenantId)
  );
  const { allItems: customers, loading: custLoading } = useRealtimeCollection(
    (tenantId) => new CustomerService(tenantId)
  );
  const { allItems: suppliers, loading: suppLoading } = useRealtimeCollection(
    (tenantId) => new SupplierService(tenantId)
  );
  const { allItems: products, loading: prodLoading } = useRealtimeCollection(
    (tenantId) => new ProductService(tenantId)
  );
  const { allItems: auditLogs, loading: auditLoading } = useRealtimeCollection(
    (tenantId) => new AuditLogService(tenantId)
  );
  const { allItems: stockTransactions } = useRealtimeCollection(
    (tenantId) => new StockTransactionService(tenantId)
  );

  const currencySymbol = currentTenant?.settings.currencySymbol || '$';
  const currencyCode = currentTenant?.settings.currency || 'USD';

  // Helper date filtering function
  const isDateInFilter = (dateStr?: string) => {
    if (!dateStr || dateFilter === 'all') return true;
    const itemDate = new Date(dateStr);
    const now = new Date();

    if (dateFilter === 'today') {
      return itemDate.toDateString() === now.toDateString();
    }
    if (dateFilter === 'this_week') {
      const weekAgo = new Date();
      weekAgo.setDate(now.getDate() - 7);
      return itemDate >= weekAgo && itemDate <= now;
    }
    if (dateFilter === 'this_month') {
      return (
        itemDate.getFullYear() === now.getFullYear() &&
        itemDate.getMonth() === now.getMonth()
      );
    }
    if (dateFilter === 'custom') {
      if (customStartDate && new Date(dateStr) < new Date(customStartDate)) return false;
      if (customEndDate) {
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        if (new Date(dateStr) > end) return false;
      }
      return true;
    }
    return true;
  };

  // Filtered ledger collections based on user selection (Excludes drafts and voided sales)
  const filteredSales = useMemo(
    () =>
      sales.filter(
        (s) =>
          !s.isDeleted &&
          s.status !== 'inactive' &&
          s.saleStatus !== 'draft' &&
          s.saleStatus !== 'void' &&
          isDateInFilter(s.date)
      ),
    [sales, dateFilter, customStartDate, customEndDate]
  );
  const filteredPurchases = useMemo(() => purchases.filter((p) => isDateInFilter(p.date)), [purchases, dateFilter, customStartDate, customEndDate]);
  const filteredExpenses = useMemo(() => expenses.filter((e) => isDateInFilter(e.date)), [expenses, dateFilter, customStartDate, customEndDate]);

  // LIVE DATABASE CALCULATIONS (NEVER HARDCODED)
  const totalSales = useMemo(() => filteredSales.reduce((acc, s) => acc + (s.totalAmount || 0), 0), [filteredSales]);
  const totalPurchases = useMemo(() => filteredPurchases.reduce((acc, p) => acc + (p.totalAmount || 0), 0), [filteredPurchases]);
  const totalExpenses = useMemo(() => filteredExpenses.reduce((acc, e) => acc + (e.totalAmount || 0), 0), [filteredExpenses]);

  // Landed Cost of Goods Sold (COGS) from sold line items
  const totalCogs = useMemo(() => {
    let cogs = 0;
    filteredSales.forEach((s) => {
      s.items?.forEach((it) => {
        cogs += (it.costPrice || 0) * (it.quantity || 0);
      });
    });
    return cogs;
  }, [filteredSales]);

  // Gross Profit = Sales - COGS
  const grossProfit = totalSales - totalCogs;
  // Net Profit = Gross Profit - Operating Expenses
  const netProfit = grossProfit - totalExpenses;

  // Real-time Liquidity & Position Balances
  const cashBalance = useMemo(
    () => accounts.filter((a) => a.type === 'cash' && a.status === 'active').reduce((acc, a) => acc + (a.currentBalance || 0), 0),
    [accounts]
  );
  const bankBalance = useMemo(
    () => accounts.filter((a) => a.type === 'bank' && a.status === 'active').reduce((acc, a) => acc + (a.currentBalance || 0), 0),
    [accounts]
  );

  // Receivables & Payables
  const customerReceivables = useMemo(
    () => customers.filter((c) => c.status === 'active').reduce((acc, c) => acc + (c.currentBalance || 0), 0),
    [customers]
  );
  const supplierPayables = useMemo(
    () => suppliers.filter((s) => s.status === 'active').reduce((acc, s) => acc + (s.currentBalance || 0), 0),
    [suppliers]
  );

  // Products & Inventory
  const totalProductsCount = products.length;
  const lowStockCount = useMemo(
    () =>
      products.filter((p) => {
        if (p.status !== 'active' || p.isDeleted) return false;
        const currentStock = calculateProductCurrentStock(p, stockTransactions);
        return currentStock <= p.minStockAlert;
      }).length,
    [products, stockTransactions]
  );

  // Recent 5 Sorted Transactions
  const recentSales = useMemo(
    () => [...sales].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5),
    [sales]
  );
  const recentPurchases = useMemo(
    () => [...purchases].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5),
    [purchases]
  );
  const recentExpenses = useMemo(
    () => [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5),
    [expenses]
  );

  const isDataLoading = salesLoading || purchasesLoading || expensesLoading || accountsLoading;

  return (
    <div className="space-y-6 pb-16">
      {/* Page Header with Action Shortcuts */}
      <PageHeader
        title={currentTenant ? `${currentTenant.name} Overview` : 'Enterprise Dashboard'}
        subtitle={`Tenant ID: ${currentTenant?.id || '—'} • Real-Time Database Calculation Engine`}
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Activity className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            {userRole.toUpperCase()} • REAL-TIME SYNC
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Link href="/settings">
              <Button variant="outline" size="sm">
                Business Settings
              </Button>
            </Link>
            <Link href="/sales">
              <Button size="sm">
                <Plus className="w-4 h-4" />
                New Sale / Action
              </Button>
            </Link>
          </div>
        }
      />

      {/* Interactive Date Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider font-mono">
            Date Filter:
          </span>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {(
              [
                { id: 'all', label: 'All Time' },
                { id: 'today', label: 'Today' },
                { id: 'this_week', label: 'This Week' },
                { id: 'this_month', label: 'This Month' },
                { id: 'custom', label: 'Custom' },
              ] as const
            ).map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setDateFilter(btn.id)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  dateFilter === btn.id
                    ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {dateFilter === 'custom' && (
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="px-2.5 py-1 rounded-md border border-slate-300 text-xs focus:ring-1 focus:ring-indigo-500"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="px-2.5 py-1 rounded-md border border-slate-300 text-xs focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        )}

        <div className="text-xs text-slate-500 font-mono">
          Showing: <span className="font-bold text-slate-800">{filteredSales.length}</span> sales •{' '}
          <span className="font-bold text-slate-800">{filteredPurchases.length}</span> purchases •{' '}
          <span className="font-bold text-slate-800">{filteredExpenses.length}</span> expenses
        </div>
      </div>

      {/* PRIMARY FINANCIAL KPIS (Row 1: Sales, Purchases, Expenses, Gross Profit, Net Profit) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Sales */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Sales</span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold text-slate-900">
              {isDataLoading ? '...' : formatCurrency(totalSales, currencyCode, currencySymbol)}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-mono">
            {filteredSales.length} invoices in period
          </p>
        </div>

        {/* Total Purchases */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Purchases</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold text-slate-900">
              {isDataLoading ? '...' : formatCurrency(totalPurchases, currencyCode, currencySymbol)}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-mono">
            {filteredPurchases.length} POs in period
          </p>
        </div>

        {/* Total Expenses */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Expenses</span>
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl font-bold text-slate-900">
              {isDataLoading ? '...' : formatCurrency(totalExpenses, currencyCode, currencySymbol)}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-mono">
            {filteredExpenses.length} vouchers recorded
          </p>
        </div>

        {/* Gross Profit */}
        <div className={`p-4 rounded-xl border shadow-2xs ${grossProfit >= 0 ? 'bg-emerald-50/40 border-emerald-200' : 'bg-rose-50/40 border-rose-200'}`}>
          <div className="flex items-center justify-between text-xs font-medium">
            <span className={grossProfit >= 0 ? 'text-emerald-800' : 'text-rose-800'}>Gross Profit</span>
            <div className={`p-2 rounded-lg ${grossProfit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className={`text-xl font-bold ${grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {isDataLoading ? '...' : formatCurrency(grossProfit, currencyCode, currencySymbol)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Sales minus Purchases
          </p>
        </div>

        {/* Net Profit */}
        <div className={`p-4 rounded-xl border shadow-2xs ${netProfit >= 0 ? 'bg-indigo-50/40 border-indigo-200' : 'bg-rose-50/40 border-rose-200'}`}>
          <div className="flex items-center justify-between text-xs font-medium">
            <span className={netProfit >= 0 ? 'text-indigo-800' : 'text-rose-800'}>Net Profit</span>
            <div className={`p-2 rounded-lg ${netProfit >= 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-rose-100 text-rose-700'}`}>
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className={`text-xl font-bold ${netProfit >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>
              {isDataLoading ? '...' : formatCurrency(netProfit, currencyCode, currencySymbol)}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Gross minus Operating Expenses
          </p>
        </div>
      </div>

      {/* LIQUIDITY & OPERATIONAL KPIS (Row 2: Cash, Bank, Receivables, Payables, Inventory) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
        {/* Cash Balance */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Cash Balance</span>
            <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600">
              <Wallet className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-bold text-slate-900 mt-1.5">
            {accountsLoading ? '...' : formatCurrency(cashBalance, currencyCode, currencySymbol)}
          </p>
          <span className="text-[10px] text-slate-400 block mt-1">Active Cash Accounts</span>
        </div>

        {/* Bank Balance */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Bank Balance</span>
            <div className="p-1.5 rounded-md bg-blue-50 text-blue-600">
              <Building2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-bold text-slate-900 mt-1.5">
            {accountsLoading ? '...' : formatCurrency(bankBalance, currencyCode, currencySymbol)}
          </p>
          <span className="text-[10px] text-slate-400 block mt-1">Bank Vault & Depository</span>
        </div>

        {/* Customer Receivables */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Receivables</span>
            <div className="p-1.5 rounded-md bg-amber-50 text-amber-600">
              <ArrowDownRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-bold text-amber-600 mt-1.5">
            {custLoading ? '...' : formatCurrency(customerReceivables, currencyCode, currencySymbol)}
          </p>
          <span className="text-[10px] text-slate-400 block mt-1">Pending from Customers</span>
        </div>

        {/* Supplier Payables */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Payables</span>
            <div className="p-1.5 rounded-md bg-rose-50 text-rose-600">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-bold text-rose-600 mt-1.5">
            {suppLoading ? '...' : formatCurrency(supplierPayables, currencyCode, currencySymbol)}
          </p>
          <span className="text-[10px] text-slate-400 block mt-1">Owed to Vendors</span>
        </div>

        {/* Total Products */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Total Products</span>
            <div className="p-1.5 rounded-md bg-purple-50 text-purple-600">
              <Package className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-lg font-bold text-slate-900 mt-1.5">
            {prodLoading ? '...' : totalProductsCount}
          </p>
          <span className="text-[10px] text-slate-400 block mt-1">Master Catalog SKUs</span>
        </div>

        {/* Low Stock Warning */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Low Stock Items</span>
            <div className="p-1.5 rounded-md bg-amber-50 text-amber-600">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className={`text-lg font-bold mt-1.5 ${lowStockCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
            {prodLoading ? '...' : lowStockCount}
          </p>
          <span className="text-[10px] text-slate-400 block mt-1">Below Reorder Point</span>
        </div>
      </div>

      {/* RECENT REAL-TIME TRANSACTION FEEDS (Sales, Purchases, Expenses) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* RECENT SALES */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
                Recent Sales
              </h3>
            </div>
            <Link
              href="/customers"
              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              All Invoices
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {recentSales.map((sale) => (
              <div key={sale.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-800">{sale.invoiceNumber}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                      sale.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {sale.paymentStatus}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 truncate mt-0.5">{sale.customerName}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">{new Date(sale.date).toLocaleDateString()}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-slate-900 block">
                    {formatCurrency(sale.totalAmount, currencyCode, currencySymbol)}
                  </span>
                  {sale.balanceAmount > 0 && (
                    <span className="text-[10px] text-rose-500 font-mono">
                      Bal: {formatCurrency(sale.balanceAmount, currencyCode, currencySymbol)}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {recentSales.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400">No sale transactions registered.</div>
            )}
          </div>
        </div>

        {/* RECENT PURCHASES */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
                Recent Purchases
              </h3>
            </div>
            <Link
              href="/purchases"
              className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              All Orders
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {recentPurchases.map((po) => (
              <div key={po.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-800">{po.poNumber}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                      po.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {po.paymentStatus}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 truncate mt-0.5">{po.supplierName}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">{new Date(po.date).toLocaleDateString()}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-slate-900 block">
                    {formatCurrency(po.totalAmount, currencyCode, currencySymbol)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {po.receiptStatus}
                  </span>
                </div>
              </div>
            ))}
            {recentPurchases.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400">No purchase orders registered.</div>
            )}
          </div>
        </div>

        {/* RECENT EXPENSES */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-rose-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono">
                Recent Expenses
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Live Feed
            </span>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {recentExpenses.map((exp) => (
              <div key={exp.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors">
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-800">{exp.expenseNumber}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold uppercase bg-slate-100 text-slate-600">
                      {exp.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 truncate mt-0.5">{exp.description}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">{new Date(exp.date).toLocaleDateString()}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-rose-600 block">
                    {formatCurrency(exp.totalAmount, currencyCode, currencySymbol)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {exp.paymentMethod.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
            {recentExpenses.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400">No expense vouchers registered.</div>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: Live Immutable Audit Trail */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Live Workspace Activity & Audit Trail</h3>
            <p className="text-xs text-slate-500">Continuous tenant activity stream across all ledger and master changes</p>
          </div>
          <Link
            href="/audit-logs"
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            Full Immutable Audit Log
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {auditLogs.slice(0, 3).map((log) => (
            <div key={log.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50/50 flex items-start gap-3 text-xs">
              <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-slate-800 truncate">{log.action}</span>
                  <span className="text-[10px] text-slate-400 font-mono shrink-0">{formatDateTime(log.timestamp)}</span>
                </div>
                <p className="text-slate-600 text-[11px] mt-0.5 leading-snug">{log.description}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">By {log.userName}</p>
              </div>
            </div>
          ))}
          {auditLogs.length === 0 && (
            <div className="col-span-3 py-6 text-center text-xs text-slate-400">No recent activity logged for this workspace.</div>
          )}
        </div>
      </div>
    </div>
  );
}

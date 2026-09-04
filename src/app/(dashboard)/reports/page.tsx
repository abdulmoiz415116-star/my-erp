'use client';

import React, { useState, useMemo } from 'react';
import { useTenant } from '@/context/TenantContext';
import {
  SaleService,
  PurchaseService,
  ExpenseService,
  PaymentService,
  AccountService,
  CustomerService,
  SupplierService,
  ProductService,
  StockTransactionService,
  CategoryService,
} from '@/services/erp.service';
import {
  SaleInvoice,
  PurchaseOrder,
  Expense,
  Payment,
  Account,
  Customer,
  Supplier,
  Product,
  StockTransaction,
  Category,
} from '@/types/erp';
import { useRealtimeCollection } from '@/hooks/useRealtimeCollection';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  BarChart3,
  ShoppingCart,
  Receipt,
  Users,
  Building,
  Package,
  ArrowUpDown,
  Landmark,
  Scale,
  CreditCard,
  Printer,
  Download,
  Calendar,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';

export type ReportType =
  | 'sales'
  | 'purchases'
  | 'expenses'
  | 'customer_outstanding'
  | 'supplier_outstanding'
  | 'stock_report'
  | 'stock_movement'
  | 'cash_report'
  | 'bank_report'
  | 'profit_loss'
  | 'payments';

export type DatePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'this_year' | 'custom';

export default function ReportsPage() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id || 'tenant-apex-corp';
  const currencySymbol = currentTenant?.settings?.currencySymbol || '$';
  const currencyCode = currentTenant?.settings?.currency || 'USD';

  // Active Report Tab
  const [activeReport, setActiveReport] = useState<ReportType>('sales');

  // Unified Filter States
  const [datePreset, setDatePreset] = useState<DatePreset>('this_month');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('all');
  const [selectedSupplierId, setSelectedSupplierId] = useState('all');
  const [selectedProductId, setSelectedProductId] = useState('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination & Sorting
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [sortField, setSortField] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Real-time Firestore Collections
  const { allItems: sales } = useRealtimeCollection<SaleInvoice>((tId) => new SaleService(tId));
  const { allItems: purchases } = useRealtimeCollection<PurchaseOrder>((tId) => new PurchaseService(tId));
  const { allItems: expenses } = useRealtimeCollection<Expense>((tId) => new ExpenseService(tId));
  const { allItems: payments } = useRealtimeCollection<Payment>((tId) => new PaymentService(tId));
  const { allItems: accounts } = useRealtimeCollection<Account>((tId) => new AccountService(tId));
  const { allItems: customers } = useRealtimeCollection<Customer>((tId) => new CustomerService(tId));
  const { allItems: suppliers } = useRealtimeCollection<Supplier>((tId) => new SupplierService(tId));
  const { allItems: products } = useRealtimeCollection<Product>((tId) => new ProductService(tId));
  const { allItems: stockTransactions } = useRealtimeCollection<StockTransaction>((tId) => new StockTransactionService(tId));
  const { allItems: categories } = useRealtimeCollection<Category>((tId) => new CategoryService(tId));

  // Date Filtering Engine
  const isDateInRange = (dateStr: string) => {
    if (!dateStr) return true;
    const itemDate = new Date(dateStr);
    const now = new Date();

    if (datePreset === 'today') {
      return (
        itemDate.getFullYear() === now.getFullYear() &&
        itemDate.getMonth() === now.getMonth() &&
        itemDate.getDate() === now.getDate()
      );
    }

    if (datePreset === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      return (
        itemDate.getFullYear() === yesterday.getFullYear() &&
        itemDate.getMonth() === yesterday.getMonth() &&
        itemDate.getDate() === yesterday.getDate()
      );
    }

    if (datePreset === 'this_week') {
      const startOfWeek = new Date(now);
      const day = now.getDay() || 7; // 1 = Monday
      startOfWeek.setDate(now.getDate() - day + 1);
      startOfWeek.setHours(0, 0, 0, 0);
      return itemDate >= startOfWeek && itemDate <= now;
    }

    if (datePreset === 'this_month') {
      return itemDate.getFullYear() === now.getFullYear() && itemDate.getMonth() === now.getMonth();
    }

    if (datePreset === 'this_year') {
      return itemDate.getFullYear() === now.getFullYear();
    }

    if (datePreset === 'custom') {
      if (customStartDate && new Date(dateStr) < new Date(customStartDate)) return false;
      if (customEndDate && new Date(dateStr) > new Date(customEndDate + 'T23:59:59')) return false;
      return true;
    }

    return true;
  };

  const getPresetLabel = () => {
    switch (datePreset) {
      case 'today':
        return 'Today';
      case 'yesterday':
        return 'Yesterday';
      case 'this_week':
        return 'This Week';
      case 'this_month':
        return 'This Month';
      case 'this_year':
        return 'This Year';
      case 'custom':
        return customStartDate && customEndDate ? `${customStartDate} to ${customEndDate}` : 'Custom Date Range';
      default:
        return 'All Time';
    }
  };

  // Reset pagination on tab or filter change
  const handleTabChange = (tab: ReportType) => {
    setActiveReport(tab);
    setCurrentPage(1);
    setSearchQuery('');
  };

  // Generic Sort Handler
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // ==========================================
  // 1. SALES REPORT DATA
  // ==========================================
  const filteredSales = useMemo(() => {
    return sales
      .filter((s) => !s.isDeleted && s.saleStatus !== 'draft')
      .filter((s) => isDateInRange(s.date))
      .filter((s) => (selectedCustomerId === 'all' ? true : s.customerId === selectedCustomerId))
      .filter((s) => (selectedPaymentStatus === 'all' ? true : s.paymentStatus === selectedPaymentStatus))
      .filter((s) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          s.invoiceNumber.toLowerCase().includes(q) ||
          s.customerName.toLowerCase().includes(q) ||
          (s.notes && s.notes.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const factor = sortDirection === 'asc' ? 1 : -1;
        if (sortField === 'totalAmount') return (a.totalAmount - b.totalAmount) * factor;
        if (sortField === 'customerName') return a.customerName.localeCompare(b.customerName) * factor;
        return (new Date(a.date).getTime() - new Date(b.date).getTime()) * factor;
      });
  }, [sales, datePreset, customStartDate, customEndDate, selectedCustomerId, selectedPaymentStatus, searchQuery, sortField, sortDirection]);

  // ==========================================
  // 2. PURCHASES REPORT DATA
  // ==========================================
  const filteredPurchases = useMemo(() => {
    return purchases
      .filter((p) => !p.isDeleted && p.purchaseStatus !== 'draft')
      .filter((p) => isDateInRange(p.date))
      .filter((p) => (selectedSupplierId === 'all' ? true : p.supplierId === selectedSupplierId))
      .filter((p) => (selectedPaymentStatus === 'all' ? true : p.paymentStatus === selectedPaymentStatus))
      .filter((p) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          p.poNumber.toLowerCase().includes(q) ||
          p.supplierName.toLowerCase().includes(q) ||
          (p.notes && p.notes.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const factor = sortDirection === 'asc' ? 1 : -1;
        if (sortField === 'totalAmount') return (a.totalAmount - b.totalAmount) * factor;
        if (sortField === 'supplierName') return a.supplierName.localeCompare(b.supplierName) * factor;
        return (new Date(a.date).getTime() - new Date(b.date).getTime()) * factor;
      });
  }, [purchases, datePreset, customStartDate, customEndDate, selectedSupplierId, selectedPaymentStatus, searchQuery, sortField, sortDirection]);

  // ==========================================
  // 3. EXPENSES REPORT DATA
  // ==========================================
  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((e) => !e.isDeleted && e.expenseStatus !== 'draft')
      .filter((e) => isDateInRange(e.date))
      .filter((e) => (selectedCategoryId === 'all' ? true : e.category === selectedCategoryId || e.categoryId === selectedCategoryId))
      .filter((e) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          e.expenseNumber.toLowerCase().includes(q) ||
          e.description.toLowerCase().includes(q) ||
          (e.vendor && e.vendor.toLowerCase().includes(q)) ||
          e.category.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const factor = sortDirection === 'asc' ? 1 : -1;
        if (sortField === 'totalAmount') return (a.totalAmount - b.totalAmount) * factor;
        if (sortField === 'category') return a.category.localeCompare(b.category) * factor;
        return (new Date(a.date).getTime() - new Date(b.date).getTime()) * factor;
      });
  }, [expenses, datePreset, customStartDate, customEndDate, selectedCategoryId, searchQuery, sortField, sortDirection]);

  // ==========================================
  // 4. CUSTOMER OUTSTANDING REPORT DATA
  // ==========================================
  const customerOutstandingData = useMemo(() => {
    return customers
      .filter((c) => !c.isDeleted)
      .map((c) => {
        const custSales = sales.filter((s) => s.customerId === c.id && !s.isDeleted && s.saleStatus !== 'void');
        const billed = custSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
        const paid = custSales.reduce((sum, s) => sum + (s.paidAmount || 0), 0);
        const outstanding = (c.currentBalance !== undefined ? c.currentBalance : billed - paid);
        return {
          id: c.id,
          code: c.code,
          name: c.name,
          phone: c.phone || '—',
          creditLimit: c.creditLimit || 0,
          openingBalance: c.openingBalance || 0,
          totalBilled: billed,
          totalPaid: paid,
          currentBalance: outstanding,
          isOverLimit: c.creditLimit > 0 && outstanding >= c.creditLimit,
        };
      })
      .filter((c) => (selectedCustomerId === 'all' ? true : c.id === selectedCustomerId))
      .filter((c) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const factor = sortDirection === 'asc' ? 1 : -1;
        if (sortField === 'currentBalance') return (a.currentBalance - b.currentBalance) * factor;
        return a.name.localeCompare(b.name) * factor;
      });
  }, [customers, sales, selectedCustomerId, searchQuery, sortField, sortDirection]);

  // ==========================================
  // 5. SUPPLIER OUTSTANDING REPORT DATA
  // ==========================================
  const supplierOutstandingData = useMemo(() => {
    return suppliers
      .filter((s) => !s.isDeleted)
      .map((s) => {
        const suppPurchases = purchases.filter((p) => p.supplierId === s.id && !p.isDeleted && p.purchaseStatus !== 'void');
        const billed = suppPurchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
        const paid = suppPurchases.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
        const outstanding = (s.currentBalance !== undefined ? s.currentBalance : billed - paid);
        return {
          id: s.id,
          code: s.code,
          name: s.name,
          companyName: s.companyName,
          phone: s.phone || '—',
          termsDays: s.paymentTermsDays || 30,
          totalPurchases: billed,
          totalPaid: paid,
          currentBalance: outstanding,
        };
      })
      .filter((s) => (selectedSupplierId === 'all' ? true : s.id === selectedSupplierId))
      .filter((s) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return s.name.toLowerCase().includes(q) || s.companyName.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const factor = sortDirection === 'asc' ? 1 : -1;
        if (sortField === 'currentBalance') return (a.currentBalance - b.currentBalance) * factor;
        return a.name.localeCompare(b.name) * factor;
      });
  }, [suppliers, purchases, selectedSupplierId, searchQuery, sortField, sortDirection]);

  // ==========================================
  // 6. STOCK REPORT DATA
  // ==========================================
  const stockReportData = useMemo(() => {
    return products
      .filter((p) => !p.isDeleted)
      .filter((p) => (selectedProductId === 'all' ? true : p.id === selectedProductId))
      .filter((p) => (selectedCategoryId === 'all' ? true : p.category === selectedCategoryId))
      .map((p) => {
        const valuation = (p.currentStock || 0) * (p.costPrice || 0);
        const minAlert = p.minStockAlert || 5;
        let stockStatus: 'In Stock' | 'Low Stock' | 'Out of Stock' = 'In Stock';
        if (p.currentStock <= 0) stockStatus = 'Out of Stock';
        else if (p.currentStock <= minAlert) stockStatus = 'Low Stock';

        return {
          id: p.id,
          sku: p.sku,
          name: p.name,
          category: p.category || 'General',
          costPrice: p.costPrice || 0,
          sellingPrice: p.sellingPrice || 0,
          currentStock: p.currentStock || 0,
          minAlert,
          valuation,
          stockStatus,
        };
      })
      .filter((p) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const factor = sortDirection === 'asc' ? 1 : -1;
        if (sortField === 'currentStock') return (a.currentStock - b.currentStock) * factor;
        if (sortField === 'valuation') return (a.valuation - b.valuation) * factor;
        return a.name.localeCompare(b.name) * factor;
      });
  }, [products, selectedProductId, selectedCategoryId, searchQuery, sortField, sortDirection]);

  // ==========================================
  // 7. STOCK MOVEMENT REPORT DATA
  // ==========================================
  const stockMovementData = useMemo(() => {
    return stockTransactions
      .filter((t) => !t.isDeleted)
      .filter((t) => isDateInRange(t.date))
      .filter((t) => (selectedProductId === 'all' ? true : t.productId === selectedProductId))
      .filter((t) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          t.productName.toLowerCase().includes(q) ||
          t.sku.toLowerCase().includes(q) ||
          t.reference.toLowerCase().includes(q) ||
          t.type.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const factor = sortDirection === 'asc' ? 1 : -1;
        if (sortField === 'quantity') return (a.quantity - b.quantity) * factor;
        return (new Date(a.date).getTime() - new Date(b.date).getTime()) * factor;
      });
  }, [stockTransactions, datePreset, customStartDate, customEndDate, selectedProductId, searchQuery, sortField, sortDirection]);

  // ==========================================
  // 8. CASH REPORT DATA
  // ==========================================
  const cashReportData = useMemo(() => {
    const cashAccounts = accounts.filter((a) => !a.isDeleted && a.type === 'cash');
    const cashAccountIds = new Set(cashAccounts.map((a) => a.id));

    return payments
      .filter((p) => !p.isDeleted && (cashAccountIds.has(p.accountId || '') || p.paymentMethod === 'cash'))
      .filter((p) => isDateInRange(p.date))
      .filter((p) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          p.paymentNumber.toLowerCase().includes(q) ||
          (p.partyName && p.partyName.toLowerCase().includes(q)) ||
          (p.reference && p.reference.toLowerCase().includes(q))
        );
      })
      .map((p) => {
        const isReceipt = p.partyType === 'customer' || p.partyType === 'direct_deposit';
        return {
          id: p.id,
          paymentNumber: p.paymentNumber,
          date: p.date,
          accountName: p.accountName || 'Cash Till',
          partyName: p.partyName || 'Cash Operation',
          partyType: p.partyType,
          inflow: isReceipt ? p.amount : 0,
          outflow: !isReceipt ? p.amount : 0,
          reference: p.reference || '—',
          notes: p.notes || '',
        };
      })
      .sort((a, b) => {
        const factor = sortDirection === 'asc' ? 1 : -1;
        return (new Date(a.date).getTime() - new Date(b.date).getTime()) * factor;
      });
  }, [accounts, payments, datePreset, customStartDate, customEndDate, searchQuery, sortField, sortDirection]);

  // ==========================================
  // 9. BANK REPORT DATA
  // ==========================================
  const bankReportData = useMemo(() => {
    const bankAccounts = accounts.filter((a) => !a.isDeleted && a.type === 'bank');
    const bankAccountIds = new Set(bankAccounts.map((a) => a.id));

    return payments
      .filter((p) => !p.isDeleted && (bankAccountIds.has(p.accountId || '') || p.paymentMethod !== 'cash'))
      .filter((p) => isDateInRange(p.date))
      .filter((p) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          p.paymentNumber.toLowerCase().includes(q) ||
          (p.partyName && p.partyName.toLowerCase().includes(q)) ||
          (p.reference && p.reference.toLowerCase().includes(q)) ||
          (p.accountName && p.accountName.toLowerCase().includes(q))
        );
      })
      .map((p) => {
        const isReceipt = p.partyType === 'customer' || p.partyType === 'direct_deposit';
        return {
          id: p.id,
          paymentNumber: p.paymentNumber,
          date: p.date,
          accountName: p.accountName || 'Commercial Bank Account',
          partyName: p.partyName || 'Banking Transaction',
          partyType: p.partyType,
          method: p.paymentMethod,
          inflow: isReceipt ? p.amount : 0,
          outflow: !isReceipt ? p.amount : 0,
          reference: p.reference || '—',
        };
      })
      .sort((a, b) => {
        const factor = sortDirection === 'asc' ? 1 : -1;
        return (new Date(a.date).getTime() - new Date(b.date).getTime()) * factor;
      });
  }, [accounts, payments, datePreset, customStartDate, customEndDate, searchQuery, sortField, sortDirection]);

  // ==========================================
  // 10. PROFIT & LOSS DATA
  // ==========================================
  const pnlData = useMemo(() => {
    const validSales = sales
      .filter((s) => !s.isDeleted && s.saleStatus !== 'draft' && s.saleStatus !== 'void')
      .filter((s) => isDateInRange(s.date));

    const returnedSales = validSales.filter((s) => s.saleStatus === 'returned');
    const normalSales = validSales.filter((s) => s.saleStatus !== 'returned');

    const grossSales = normalSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const salesReturns = returnedSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
    const netSales = grossSales - salesReturns;

    // COGS based on sold goods acquisition cost
    let cogsTotal = 0;
    normalSales.forEach((s) => {
      s.items?.forEach((it) => {
        cogsTotal += (it.costPrice || 0) * (it.quantity || 0);
      });
    });
    returnedSales.forEach((s) => {
      s.items?.forEach((it) => {
        cogsTotal -= (it.costPrice || 0) * (it.quantity || 0);
      });
    });
    cogsTotal = Math.max(0, cogsTotal);

    const grossProfit = netSales - cogsTotal;
    const grossMargin = netSales > 0 ? ((grossProfit / netSales) * 100).toFixed(1) : '0.0';

    // Operating expenses
    const validExpenses = expenses
      .filter((e) => !e.isDeleted && e.expenseStatus !== 'draft' && e.expenseStatus !== 'void')
      .filter((e) => isDateInRange(e.date));

    const categoryMap: Record<string, number> = {};
    validExpenses.forEach((e) => {
      const cat = e.category || 'General';
      categoryMap[cat] = (categoryMap[cat] || 0) + (e.amount || 0);
    });

    const totalOperatingExpenses = validExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netOperatingProfit = grossProfit - totalOperatingExpenses;
    const netMargin = netSales > 0 ? ((netOperatingProfit / netSales) * 100).toFixed(1) : '0.0';

    return {
      grossSales,
      salesReturns,
      netSales,
      cogsTotal,
      grossProfit,
      grossMargin,
      categoryMap,
      totalOperatingExpenses,
      netOperatingProfit,
      netMargin,
    };
  }, [sales, expenses, datePreset, customStartDate, customEndDate]);

  // ==========================================
  // 11. PAYMENTS REPORT DATA
  // ==========================================
  const paymentsReportData = useMemo(() => {
    return payments
      .filter((p) => !p.isDeleted)
      .filter((p) => isDateInRange(p.date))
      .filter((p) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          p.paymentNumber.toLowerCase().includes(q) ||
          (p.partyName && p.partyName.toLowerCase().includes(q)) ||
          p.partyType.toLowerCase().includes(q) ||
          (p.reference && p.reference.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const factor = sortDirection === 'asc' ? 1 : -1;
        if (sortField === 'amount') return (a.amount - b.amount) * factor;
        return (new Date(a.date).getTime() - new Date(b.date).getTime()) * factor;
      });
  }, [payments, datePreset, customStartDate, customEndDate, searchQuery, sortField, sortDirection]);

  // ==========================================
  // EXPORT TO CSV FUNCTION
  // ==========================================
  const exportCurrentReportCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = `report_${activeReport}_${datePreset}.csv`;

    if (activeReport === 'sales') {
      headers = ['Invoice #', 'Date', 'Customer', 'Items Qty', 'Total Amount', 'Paid Amount', 'Balance', 'Payment Status', 'Sale Status'];
      rows = filteredSales.map((s) => [
        s.invoiceNumber,
        formatDate(s.date),
        `"${s.customerName.replace(/"/g, '""')}"`,
        s.items?.length || 0,
        s.totalAmount.toFixed(2),
        s.paidAmount.toFixed(2),
        s.balanceAmount.toFixed(2),
        s.paymentStatus,
        s.saleStatus || 'posted',
      ]);
    } else if (activeReport === 'purchases') {
      headers = ['PO #', 'Date', 'Supplier', 'Items Qty', 'Total Amount', 'Paid Amount', 'Balance', 'Payment Status', 'Receipt Status'];
      rows = filteredPurchases.map((p) => [
        p.poNumber,
        formatDate(p.date),
        `"${p.supplierName.replace(/"/g, '""')}"`,
        p.items?.length || 0,
        p.totalAmount.toFixed(2),
        p.paidAmount.toFixed(2),
        p.balanceAmount.toFixed(2),
        p.paymentStatus,
        p.receiptStatus,
      ]);
    } else if (activeReport === 'expenses') {
      headers = ['Expense #', 'Date', 'Category', 'Payee / Vendor', 'Description', 'Account', 'Method', 'Total Amount', 'Status'];
      rows = filteredExpenses.map((e) => [
        e.expenseNumber,
        formatDate(e.date),
        `"${e.category}"`,
        `"${(e.vendor || '').replace(/"/g, '""')}"`,
        `"${e.description.replace(/"/g, '""')}"`,
        `"${e.accountName}"`,
        e.paymentMethod,
        e.totalAmount.toFixed(2),
        e.expenseStatus || 'posted',
      ]);
    } else if (activeReport === 'customer_outstanding') {
      headers = ['Customer Code', 'Name', 'Phone', 'Credit Limit', 'Total Invoiced', 'Total Paid', 'Outstanding Balance'];
      rows = customerOutstandingData.map((c) => [
        c.code,
        `"${c.name.replace(/"/g, '""')}"`,
        c.phone,
        c.creditLimit.toFixed(2),
        c.totalBilled.toFixed(2),
        c.totalPaid.toFixed(2),
        c.currentBalance.toFixed(2),
      ]);
    } else if (activeReport === 'supplier_outstanding') {
      headers = ['Supplier Code', 'Name', 'Company', 'Phone', 'Terms (Days)', 'Total Purchases', 'Total Paid', 'Outstanding Payable'];
      rows = supplierOutstandingData.map((s) => [
        s.code,
        `"${s.name.replace(/"/g, '""')}"`,
        `"${s.companyName.replace(/"/g, '""')}"`,
        s.phone,
        s.termsDays,
        s.totalPurchases.toFixed(2),
        s.totalPaid.toFixed(2),
        s.currentBalance.toFixed(2),
      ]);
    } else if (activeReport === 'stock_report') {
      headers = ['SKU', 'Product Name', 'Category', 'Cost Price', 'Selling Price', 'On Hand Stock', 'Min Alert', 'Inventory Valuation', 'Status'];
      rows = stockReportData.map((p) => [
        p.sku,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${p.category}"`,
        p.costPrice.toFixed(2),
        p.sellingPrice.toFixed(2),
        p.currentStock,
        p.minAlert,
        p.valuation.toFixed(2),
        p.stockStatus,
      ]);
    } else if (activeReport === 'stock_movement') {
      headers = ['Date', 'Reference', 'Product Name', 'SKU', 'Type', 'Direction', 'Quantity', 'Unit Cost', 'Total Cost'];
      rows = stockMovementData.map((m) => [
        formatDate(m.date),
        m.reference,
        `"${m.productName.replace(/"/g, '""')}"`,
        m.sku,
        m.type,
        m.direction.toUpperCase(),
        m.quantity,
        m.cost.toFixed(2),
        m.totalCost.toFixed(2),
      ]);
    } else if (activeReport === 'cash_report') {
      headers = ['Date', 'Payment #', 'Cash Account / Till', 'Party / Purpose', 'Inflow', 'Outflow', 'Reference'];
      rows = cashReportData.map((c) => [
        formatDate(c.date),
        c.paymentNumber,
        `"${c.accountName}"`,
        `"${c.partyName.replace(/"/g, '""')}"`,
        c.inflow.toFixed(2),
        c.outflow.toFixed(2),
        c.reference,
      ]);
    } else if (activeReport === 'bank_report') {
      headers = ['Date', 'Payment #', 'Bank Account', 'Party Name', 'Method', 'Inflow', 'Outflow', 'Reference'];
      rows = bankReportData.map((b) => [
        formatDate(b.date),
        b.paymentNumber,
        `"${b.accountName}"`,
        `"${b.partyName.replace(/"/g, '""')}"`,
        b.method,
        b.inflow.toFixed(2),
        b.outflow.toFixed(2),
        b.reference,
      ]);
    } else if (activeReport === 'profit_loss') {
      headers = ['Financial Metric', `Amount (${currencySymbol})`];
      rows = [
        ['Gross Sales Revenue', pnlData.grossSales.toFixed(2)],
        ['Less: Sales Returns', `-${pnlData.salesReturns.toFixed(2)}`],
        ['Net Commercial Sales', pnlData.netSales.toFixed(2)],
        ['Less: Cost of Goods Sold (COGS)', `-${pnlData.cogsTotal.toFixed(2)}`],
        ['Gross Operating Profit', pnlData.grossProfit.toFixed(2)],
        ['Gross Margin %', `${pnlData.grossMargin}%`],
        ['Total Operating Overhead', `-${pnlData.totalOperatingExpenses.toFixed(2)}`],
        ['Net Operating Profit', pnlData.netOperatingProfit.toFixed(2)],
        ['Net Margin %', `${pnlData.netMargin}%`],
      ];
    } else if (activeReport === 'payments') {
      headers = ['Payment #', 'Date', 'Party Type', 'Party Name', 'Method', 'Amount', 'Reference'];
      rows = paymentsReportData.map((p) => [
        p.paymentNumber,
        formatDate(p.date),
        p.partyType,
        `"${(p.partyName || '').replace(/"/g, '""')}"`,
        p.paymentMethod,
        p.amount.toFixed(2),
        p.reference || '—',
      ]);
    }

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ==========================================
  // PRINT CURRENT REPORT
  // ==========================================
  const printCurrentReport = () => {
    window.print();
  };

  // Current report list for pagination
  const getCurrentReportData = () => {
    switch (activeReport) {
      case 'sales':
        return filteredSales;
      case 'purchases':
        return filteredPurchases;
      case 'expenses':
        return filteredExpenses;
      case 'customer_outstanding':
        return customerOutstandingData;
      case 'supplier_outstanding':
        return supplierOutstandingData;
      case 'stock_report':
        return stockReportData;
      case 'stock_movement':
        return stockMovementData;
      case 'cash_report':
        return cashReportData;
      case 'bank_report':
        return bankReportData;
      case 'payments':
        return paymentsReportData;
      default:
        return [];
    }
  };

  const rawData = getCurrentReportData();
  const totalItems = rawData.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return rawData.slice(start, start + pageSize);
  }, [rawData, currentPage, pageSize]);

  // Report Navigation Tabs Configuration
  const reportTabs: { id: ReportType; label: string; icon: React.ElementType }[] = [
    { id: 'sales', label: '1. Sales Report', icon: BarChart3 },
    { id: 'purchases', label: '2. Purchase Report', icon: ShoppingCart },
    { id: 'expenses', label: '3. Expense Report', icon: Receipt },
    { id: 'customer_outstanding', label: '4. Customer Outstanding', icon: Users },
    { id: 'supplier_outstanding', label: '5. Supplier Outstanding', icon: Building },
    { id: 'stock_report', label: '6. Stock Report', icon: Package },
    { id: 'stock_movement', label: '7. Stock Movement', icon: ArrowUpDown },
    { id: 'cash_report', label: '8. Cash Report', icon: Landmark },
    { id: 'bank_report', label: '9. Bank Report', icon: CreditCard },
    { id: 'profit_loss', label: '10. Profit & Loss', icon: Scale },
    { id: 'payments', label: '11. Payment Report', icon: ArrowUpRight },
  ];

  return (
    <div className="space-y-6 max-w-7xl pb-16">
      {/* Header & Export Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Enterprise Reporting & Business Intelligence"
          subtitle={`Live operational ledgers, database reports, and cashflow intelligence for ${currentTenant?.name || 'Enterprise'}`}
        />
        <div className="flex items-center gap-2.5 print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={printCurrentReport}
            className="flex items-center gap-1.5 text-xs font-semibold"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            Print Report
          </Button>
          <Button
            size="sm"
            onClick={exportCurrentReportCSV}
            className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* 11 Navigation Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 p-2 shadow-2xs print:hidden overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {reportTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeReport === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all select-none ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Unified Multi-Filter Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Preset Selector */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as DatePreset)}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="this_year">This Year</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Custom Date Inputs if custom is chosen */}
          {datePreset === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none"
              />
            </div>
          )}

          {/* Customer Filter */}
          {(activeReport === 'sales' || activeReport === 'customer_outstanding') && (
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none"
            >
              <option value="all">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          {/* Supplier Filter */}
          {(activeReport === 'purchases' || activeReport === 'supplier_outstanding') && (
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none"
            >
              <option value="all">All Suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.companyName || s.name}
                </option>
              ))}
            </select>
          )}

          {/* Product Filter */}
          {(activeReport === 'stock_report' || activeReport === 'stock_movement') && (
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none"
            >
              <option value="all">All Products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          )}

          {/* Category Filter */}
          {(activeReport === 'expenses' || activeReport === 'stock_report') && (
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          )}

          {/* Payment Status Filter */}
          {(activeReport === 'sales' || activeReport === 'purchases') && (
            <select
              value={selectedPaymentStatus}
              onChange={(e) => setSelectedPaymentStatus(e.target.value as 'all' | 'paid' | 'partial' | 'unpaid')}
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none"
            >
              <option value="all">All Payment Statuses</option>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="unpaid">Unpaid</option>
            </select>
          )}

          {/* Search Box */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by keyword, invoice, party, or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Filter Metadata Tag */}
        <div className="text-[11px] text-slate-500 flex items-center gap-2">
          <span>Active Period:</span>
          <span className="font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
            {getPresetLabel()}
          </span>
          <span>• Total Matching Records: {activeReport === 'profit_loss' ? 1 : totalItems}</span>
        </div>
      </div>

      {/* ========================================== */}
      {/* REPORT CONTENT PER ACTIVE TAB */}
      {/* ========================================== */}

      {/* 1. SALES REPORT */}
      {activeReport === 'sales' && (
        <div className="space-y-4">
          {/* KPI Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 uppercase font-bold">Total Invoiced</span>
              <p className="text-xl font-bold text-slate-900 mt-1 font-mono">
                {formatCurrency(filteredSales.reduce((s, x) => s + x.totalAmount, 0), currencyCode, currencySymbol)}
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 uppercase font-bold">Collected Receipts</span>
              <p className="text-xl font-bold text-emerald-600 mt-1 font-mono">
                {formatCurrency(filteredSales.reduce((s, x) => s + x.paidAmount, 0), currencyCode, currencySymbol)}
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 uppercase font-bold">Pending Receivables</span>
              <p className="text-xl font-bold text-rose-600 mt-1 font-mono">
                {formatCurrency(filteredSales.reduce((s, x) => s + x.balanceAmount, 0), currencyCode, currencySymbol)}
              </p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3 cursor-pointer" onClick={() => handleSort('date')}>Date</th>
                  <th className="p-3">Invoice #</th>
                  <th className="p-3 cursor-pointer" onClick={() => handleSort('customerName')}>Customer</th>
                  <th className="p-3 text-right">Items</th>
                  <th className="p-3 text-right cursor-pointer" onClick={() => handleSort('totalAmount')}>Total</th>
                  <th className="p-3 text-right">Paid</th>
                  <th className="p-3 text-right">Balance</th>
                  <th className="p-3 text-center">Payment Status</th>
                  <th className="p-3 text-center">Sale Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {paginatedData.map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 text-slate-600">{formatDate(s.date)}</td>
                    <td className="p-3 font-bold text-indigo-600">{s.invoiceNumber}</td>
                    <td className="p-3 font-sans font-semibold text-slate-800">{s.customerName}</td>
                    <td className="p-3 text-right text-slate-600">{s.items?.length || 0}</td>
                    <td className="p-3 text-right font-bold text-slate-900">
                      {formatCurrency(s.totalAmount, currencyCode, currencySymbol)}
                    </td>
                    <td className="p-3 text-right font-semibold text-emerald-600">
                      {formatCurrency(s.paidAmount, currencyCode, currencySymbol)}
                    </td>
                    <td className="p-3 text-right font-semibold text-rose-600">
                      {formatCurrency(s.balanceAmount, currencyCode, currencySymbol)}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        s.paymentStatus === 'paid'
                          ? 'bg-emerald-50 text-emerald-700'
                          : s.paymentStatus === 'partial'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}>
                        {s.paymentStatus}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                        {s.saleStatus || 'posted'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. PURCHASE REPORT */}
      {activeReport === 'purchases' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 uppercase font-bold">Total Purchases</span>
              <p className="text-xl font-bold text-slate-900 mt-1 font-mono">
                {formatCurrency(filteredPurchases.reduce((s, x) => s + x.totalAmount, 0), currencyCode, currencySymbol)}
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 uppercase font-bold">Paid to Vendors</span>
              <p className="text-xl font-bold text-emerald-600 mt-1 font-mono">
                {formatCurrency(filteredPurchases.reduce((s, x) => s + x.paidAmount, 0), currencyCode, currencySymbol)}
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 uppercase font-bold">Trade Payables</span>
              <p className="text-xl font-bold text-amber-600 mt-1 font-mono">
                {formatCurrency(filteredPurchases.reduce((s, x) => s + x.balanceAmount, 0), currencyCode, currencySymbol)}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3 cursor-pointer" onClick={() => handleSort('date')}>Date</th>
                  <th className="p-3">PO #</th>
                  <th className="p-3 cursor-pointer" onClick={() => handleSort('supplierName')}>Supplier</th>
                  <th className="p-3 text-right">Items</th>
                  <th className="p-3 text-right cursor-pointer" onClick={() => handleSort('totalAmount')}>Total</th>
                  <th className="p-3 text-right">Paid</th>
                  <th className="p-3 text-right">Balance</th>
                  <th className="p-3 text-center">Payment Status</th>
                  <th className="p-3 text-center">Receipt Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {paginatedData.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 text-slate-600">{formatDate(p.date)}</td>
                    <td className="p-3 font-bold text-indigo-600">{p.poNumber}</td>
                    <td className="p-3 font-sans font-semibold text-slate-800">{p.supplierName}</td>
                    <td className="p-3 text-right text-slate-600">{p.items?.length || 0}</td>
                    <td className="p-3 text-right font-bold text-slate-900">
                      {formatCurrency(p.totalAmount, currencyCode, currencySymbol)}
                    </td>
                    <td className="p-3 text-right font-semibold text-emerald-600">
                      {formatCurrency(p.paidAmount, currencyCode, currencySymbol)}
                    </td>
                    <td className="p-3 text-right font-semibold text-rose-600">
                      {formatCurrency(p.balanceAmount, currencyCode, currencySymbol)}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        p.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {p.paymentStatus}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                        {p.receiptStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. EXPENSE REPORT */}
      {activeReport === 'expenses' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 uppercase font-bold">Total Operating Disbursements</span>
              <p className="text-xl font-bold text-slate-900 mt-1 font-mono">
                {formatCurrency(filteredExpenses.reduce((s, x) => s + x.totalAmount, 0), currencyCode, currencySymbol)}
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 uppercase font-bold">Total Expense Records</span>
              <p className="text-xl font-bold text-indigo-600 mt-1 font-mono">
                {filteredExpenses.length} Vouchers
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3 cursor-pointer" onClick={() => handleSort('date')}>Date</th>
                  <th className="p-3">Expense #</th>
                  <th className="p-3 cursor-pointer" onClick={() => handleSort('category')}>Category</th>
                  <th className="p-3">Payee / Vendor</th>
                  <th className="p-3">Disbursement Account</th>
                  <th className="p-3">Method</th>
                  <th className="p-3 text-right cursor-pointer" onClick={() => handleSort('totalAmount')}>Amount</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {paginatedData.map((e: any) => (
                  <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 text-slate-600">{formatDate(e.date)}</td>
                    <td className="p-3 font-bold text-indigo-600">{e.expenseNumber}</td>
                    <td className="p-3 font-sans font-semibold text-slate-800">{e.category}</td>
                    <td className="p-3 font-sans text-slate-700">{e.vendor || '—'}</td>
                    <td className="p-3 font-sans text-slate-600">{e.accountName}</td>
                    <td className="p-3 uppercase text-[10px] text-slate-600">{e.paymentMethod}</td>
                    <td className="p-3 text-right font-bold text-slate-900">
                      {formatCurrency(e.totalAmount, currencyCode, currencySymbol)}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        e.expenseStatus === 'posted' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {e.expenseStatus || 'posted'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. CUSTOMER OUTSTANDING */}
      {activeReport === 'customer_outstanding' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 uppercase font-bold">Total Active Receivables</span>
              <p className="text-xl font-bold text-rose-600 mt-1 font-mono">
                {formatCurrency(customerOutstandingData.reduce((s, x) => s + Math.max(0, x.currentBalance), 0), currencyCode, currencySymbol)}
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 uppercase font-bold">Total Outstanding Accounts</span>
              <p className="text-xl font-bold text-slate-900 mt-1 font-mono">
                {customerOutstandingData.filter((c) => c.currentBalance > 0).length} of {customerOutstandingData.length} Customers
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Code</th>
                  <th className="p-3">Customer Name</th>
                  <th className="p-3">Contact Phone</th>
                  <th className="p-3 text-right">Credit Limit</th>
                  <th className="p-3 text-right">Total Billed</th>
                  <th className="p-3 text-right">Total Paid</th>
                  <th className="p-3 text-right cursor-pointer" onClick={() => handleSort('currentBalance')}>Outstanding Balance</th>
                  <th className="p-3 text-center">Limit Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {paginatedData.map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-bold text-slate-800">{c.code}</td>
                    <td className="p-3 font-sans font-semibold text-slate-900">{c.name}</td>
                    <td className="p-3 text-slate-600">{c.phone}</td>
                    <td className="p-3 text-right text-slate-700">
                      {formatCurrency(c.creditLimit, currencyCode, currencySymbol)}
                    </td>
                    <td className="p-3 text-right text-slate-700">
                      {formatCurrency(c.totalBilled, currencyCode, currencySymbol)}
                    </td>
                    <td className="p-3 text-right text-emerald-600">
                      {formatCurrency(c.totalPaid, currencyCode, currencySymbol)}
                    </td>
                    <td className="p-3 text-right font-bold text-rose-600">
                      {formatCurrency(c.currentBalance, currencyCode, currencySymbol)}
                    </td>
                    <td className="p-3 text-center">
                      {c.isOverLimit ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-700">
                          Exceeded
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700">
                          Safe
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. SUPPLIER OUTSTANDING */}
      {activeReport === 'supplier_outstanding' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 uppercase font-bold">Total Trade Payables</span>
              <p className="text-xl font-bold text-amber-600 mt-1 font-mono">
                {formatCurrency(supplierOutstandingData.reduce((s, x) => s + Math.max(0, x.currentBalance), 0), currencyCode, currencySymbol)}
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 uppercase font-bold">Active Suppliers</span>
              <p className="text-xl font-bold text-slate-900 mt-1 font-mono">
                {supplierOutstandingData.length} Vendors
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Code</th>
                  <th className="p-3">Supplier Name</th>
                  <th className="p-3">Company</th>
                  <th className="p-3">Contact Phone</th>
                  <th className="p-3 text-center">Terms</th>
                  <th className="p-3 text-right">Total Purchases</th>
                  <th className="p-3 text-right">Total Paid</th>
                  <th className="p-3 text-right cursor-pointer" onClick={() => handleSort('currentBalance')}>Outstanding Payable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {paginatedData.map((s: any) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-bold text-slate-800">{s.code}</td>
                    <td className="p-3 font-sans font-semibold text-slate-900">{s.name}</td>
                    <td className="p-3 font-sans text-slate-700">{s.companyName}</td>
                    <td className="p-3 text-slate-600">{s.phone}</td>
                    <td className="p-3 text-center text-slate-600">{s.termsDays} days</td>
                    <td className="p-3 text-right text-slate-700">
                      {formatCurrency(s.totalPurchases, currencyCode, currencySymbol)}
                    </td>
                    <td className="p-3 text-right text-emerald-600">
                      {formatCurrency(s.totalPaid, currencyCode, currencySymbol)}
                    </td>
                    <td className="p-3 text-right font-bold text-amber-600">
                      {formatCurrency(s.currentBalance, currencyCode, currencySymbol)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. STOCK REPORT */}
      {activeReport === 'stock_report' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 uppercase font-bold">Total Inventory Valuation</span>
              <p className="text-xl font-bold text-slate-900 mt-1 font-mono">
                {formatCurrency(stockReportData.reduce((s, x) => s + x.valuation, 0), currencyCode, currencySymbol)}
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 uppercase font-bold">Units on Hand</span>
              <p className="text-xl font-bold text-indigo-600 mt-1 font-mono">
                {stockReportData.reduce((s, x) => s + x.currentStock, 0)} Units
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 uppercase font-bold">Low / Depleted Items</span>
              <p className="text-xl font-bold text-rose-600 mt-1 font-mono">
                {stockReportData.filter((x) => x.stockStatus !== 'In Stock').length} SKUs
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Product Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3 text-right">Unit Cost</th>
                  <th className="p-3 text-right">Selling Price</th>
                  <th className="p-3 text-right cursor-pointer" onClick={() => handleSort('currentStock')}>On-Hand Stock</th>
                  <th className="p-3 text-right cursor-pointer" onClick={() => handleSort('valuation')}>Valuation</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {paginatedData.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-bold text-slate-800">{p.sku}</td>
                    <td className="p-3 font-sans font-semibold text-slate-900">{p.name}</td>
                    <td className="p-3 font-sans text-slate-600">{p.category}</td>
                    <td className="p-3 text-right text-slate-700">
                      {formatCurrency(p.costPrice, currencyCode, currencySymbol)}
                    </td>
                    <td className="p-3 text-right text-slate-700">
                      {formatCurrency(p.sellingPrice, currencyCode, currencySymbol)}
                    </td>
                    <td className="p-3 text-right font-bold text-indigo-700">
                      {p.currentStock}
                    </td>
                    <td className="p-3 text-right font-bold text-slate-900">
                      {formatCurrency(p.valuation, currencyCode, currencySymbol)}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        p.stockStatus === 'In Stock'
                          ? 'bg-emerald-50 text-emerald-700'
                          : p.stockStatus === 'Low Stock'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}>
                        {p.stockStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. STOCK MOVEMENT REPORT */}
      {activeReport === 'stock_movement' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 uppercase font-bold">Total Inward Movements</span>
              <p className="text-xl font-bold text-emerald-600 mt-1 font-mono">
                +{stockMovementData.filter((x) => x.direction === 'in').reduce((s, x) => s + x.quantity, 0)} Units
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 uppercase font-bold">Total Outward Dispatches</span>
              <p className="text-xl font-bold text-rose-600 mt-1 font-mono">
                -{stockMovementData.filter((x) => x.direction === 'out').reduce((s, x) => s + x.quantity, 0)} Units
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3 cursor-pointer" onClick={() => handleSort('date')}>Date</th>
                  <th className="p-3">Reference</th>
                  <th className="p-3">Product Name</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Type</th>
                  <th className="p-3 text-center">Direction</th>
                  <th className="p-3 text-right cursor-pointer" onClick={() => handleSort('quantity')}>Quantity</th>
                  <th className="p-3 text-right">Unit Cost</th>
                  <th className="p-3 text-right">Total Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {paginatedData.map((m: any) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 text-slate-600">{formatDate(m.date)}</td>
                    <td className="p-3 font-bold text-indigo-600">{m.reference}</td>
                    <td className="p-3 font-sans font-semibold text-slate-900">{m.productName}</td>
                    <td className="p-3 text-slate-600">{m.sku}</td>
                    <td className="p-3 text-slate-700 uppercase text-[10px]">{m.type}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        m.direction === 'in' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {m.direction.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3 text-right font-bold text-slate-900">{m.quantity}</td>
                    <td className="p-3 text-right text-slate-700">
                      {formatCurrency(m.cost, currencyCode, currencySymbol)}
                    </td>
                    <td className="p-3 text-right font-bold text-slate-900">
                      {formatCurrency(m.totalCost, currencyCode, currencySymbol)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. CASH REPORT */}
      {activeReport === 'cash_report' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 uppercase font-bold">Total Cash Receipts (Inflow)</span>
              <p className="text-xl font-bold text-emerald-600 mt-1 font-mono">
                +{formatCurrency(cashReportData.reduce((s, x) => s + x.inflow, 0), currencyCode, currencySymbol)}
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 uppercase font-bold">Total Cash Disbursements (Outflow)</span>
              <p className="text-xl font-bold text-rose-600 mt-1 font-mono">
                -{formatCurrency(cashReportData.reduce((s, x) => s + x.outflow, 0), currencyCode, currencySymbol)}
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 uppercase font-bold">Net Cash Movement</span>
              <p className="text-xl font-bold text-indigo-700 mt-1 font-mono">
                {formatCurrency(
                  cashReportData.reduce((s, x) => s + x.inflow - x.outflow, 0),
                  currencyCode,
                  currencySymbol
                )}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Voucher #</th>
                  <th className="p-3">Account / Till</th>
                  <th className="p-3">Party / Beneficiary</th>
                  <th className="p-3 text-right">Cash Inflow</th>
                  <th className="p-3 text-right">Cash Outflow</th>
                  <th className="p-3">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {paginatedData.map((c: any) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 text-slate-600">{formatDate(c.date)}</td>
                    <td className="p-3 font-bold text-indigo-600">{c.paymentNumber}</td>
                    <td className="p-3 font-sans font-semibold text-slate-800">{c.accountName}</td>
                    <td className="p-3 font-sans text-slate-700">{c.partyName}</td>
                    <td className="p-3 text-right font-bold text-emerald-600">
                      {c.inflow > 0 ? formatCurrency(c.inflow, currencyCode, currencySymbol) : '—'}
                    </td>
                    <td className="p-3 text-right font-bold text-rose-600">
                      {c.outflow > 0 ? formatCurrency(c.outflow, currencyCode, currencySymbol) : '—'}
                    </td>
                    <td className="p-3 text-slate-600">{c.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 9. BANK REPORT */}
      {activeReport === 'bank_report' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 uppercase font-bold">Bank Deposits (Inflow)</span>
              <p className="text-xl font-bold text-emerald-600 mt-1 font-mono">
                +{formatCurrency(bankReportData.reduce((s, x) => s + x.inflow, 0), currencyCode, currencySymbol)}
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 uppercase font-bold">Bank Disbursements (Outflow)</span>
              <p className="text-xl font-bold text-rose-600 mt-1 font-mono">
                -{formatCurrency(bankReportData.reduce((s, x) => s + x.outflow, 0), currencyCode, currencySymbol)}
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 uppercase font-bold">Net Bank Movement</span>
              <p className="text-xl font-bold text-indigo-700 mt-1 font-mono">
                {formatCurrency(
                  bankReportData.reduce((s, x) => s + x.inflow - x.outflow, 0),
                  currencyCode,
                  currencySymbol
                )}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Voucher #</th>
                  <th className="p-3">Bank Account</th>
                  <th className="p-3">Party Name</th>
                  <th className="p-3">Method</th>
                  <th className="p-3 text-right">Inflow</th>
                  <th className="p-3 text-right">Outflow</th>
                  <th className="p-3">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {paginatedData.map((b: any) => (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 text-slate-600">{formatDate(b.date)}</td>
                    <td className="p-3 font-bold text-indigo-600">{b.paymentNumber}</td>
                    <td className="p-3 font-sans font-semibold text-slate-800">{b.accountName}</td>
                    <td className="p-3 font-sans text-slate-700">{b.partyName}</td>
                    <td className="p-3 uppercase text-[10px] text-slate-600">{b.method}</td>
                    <td className="p-3 text-right font-bold text-emerald-600">
                      {b.inflow > 0 ? formatCurrency(b.inflow, currencyCode, currencySymbol) : '—'}
                    </td>
                    <td className="p-3 text-right font-bold text-rose-600">
                      {b.outflow > 0 ? formatCurrency(b.outflow, currencyCode, currencySymbol) : '—'}
                    </td>
                    <td className="p-3 text-slate-600">{b.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 10. PROFIT & LOSS REPORT */}
      {activeReport === 'profit_loss' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h3 className="text-base font-bold text-slate-900">Economic Statement of Profit & Loss</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Period: {getPresetLabel()} • Calculated with strict double-entry Cost of Goods Sold (Purchases capitalized into inventory)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Revenue & Gross Profit */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                1. Commercial Revenue & Gross Margin
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-600">Gross Invoiced Sales:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrency(pnlData.grossSales, currencyCode, currencySymbol)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-50 text-rose-600">
                  <span>Less: Commercial Sales Returns:</span>
                  <span className="font-mono font-bold">
                    -{formatCurrency(pnlData.salesReturns, currencyCode, currencySymbol)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 font-bold text-slate-800 bg-slate-50 px-2 rounded">
                  <span>Net Commercial Revenue:</span>
                  <span className="font-mono text-indigo-700">
                    {formatCurrency(pnlData.netSales, currencyCode, currencySymbol)}
                  </span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-50 text-amber-700">
                  <span>Less: Cost of Goods Sold (Landed Acquisition Cost):</span>
                  <span className="font-mono font-bold">
                    -{formatCurrency(pnlData.cogsTotal, currencyCode, currencySymbol)}
                  </span>
                </div>
                <div className="flex justify-between py-2 text-sm font-bold text-emerald-700 bg-emerald-50/80 px-2 rounded border border-emerald-200">
                  <span>Gross Operating Profit:</span>
                  <span className="font-mono">
                    {formatCurrency(pnlData.grossProfit, currencyCode, currencySymbol)} ({pnlData.grossMargin}%)
                  </span>
                </div>
              </div>
            </div>

            {/* Operating Expenses & Net Profit */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
                2. Operating Overhead & Net Profit
              </h4>
              <div className="space-y-2 text-xs">
                {Object.entries(pnlData.categoryMap).length === 0 ? (
                  <p className="text-slate-400 italic">No operating expenses recorded for this period.</p>
                ) : (
                  Object.entries(pnlData.categoryMap).map(([cat, amt]) => (
                    <div key={cat} className="flex justify-between py-1.5 border-b border-slate-50 text-slate-600">
                      <span>{cat}:</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {formatCurrency(amt, currencyCode, currencySymbol)}
                      </span>
                    </div>
                  ))
                )}
                <div className="flex justify-between py-1.5 font-bold text-slate-800 bg-slate-50 px-2 rounded">
                  <span>Total Operating Expenses:</span>
                  <span className="font-mono text-rose-600">
                    -{formatCurrency(pnlData.totalOperatingExpenses, currencyCode, currencySymbol)}
                  </span>
                </div>
                <div className="flex justify-between py-2 text-sm font-bold text-indigo-700 bg-indigo-50/80 px-2 rounded border border-indigo-200 mt-4">
                  <span>Net Operating Profit:</span>
                  <span className="font-mono">
                    {formatCurrency(pnlData.netOperatingProfit, currencyCode, currencySymbol)} ({pnlData.netMargin}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 11. PAYMENTS REPORT */}
      {activeReport === 'payments' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 uppercase font-bold">Total Receipts Collected</span>
              <p className="text-xl font-bold text-emerald-600 mt-1 font-mono">
                {formatCurrency(
                  paymentsReportData
                    .filter((p) => p.partyType === 'customer' || p.partyType === 'direct_deposit')
                    .reduce((s, x) => s + x.amount, 0),
                  currencyCode,
                  currencySymbol
                )}
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 uppercase font-bold">Total Vendor Disbursements</span>
              <p className="text-xl font-bold text-rose-600 mt-1 font-mono">
                {formatCurrency(
                  paymentsReportData
                    .filter((p) => p.partyType === 'supplier' || p.partyType === 'direct_withdrawal')
                    .reduce((s, x) => s + x.amount, 0),
                  currencyCode,
                  currencySymbol
                )}
              </p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-xs text-slate-500 uppercase font-bold">Total Transactions</span>
              <p className="text-xl font-bold text-indigo-700 mt-1 font-mono">
                {paymentsReportData.length} Vouchers
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Voucher #</th>
                  <th className="p-3">Party Type</th>
                  <th className="p-3">Beneficiary / Payer</th>
                  <th className="p-3">Payment Method</th>
                  <th className="p-3">Account</th>
                  <th className="p-3 text-right cursor-pointer" onClick={() => handleSort('amount')}>Amount</th>
                  <th className="p-3">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {paginatedData.map((p: any) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 text-slate-600">{formatDate(p.date)}</td>
                    <td className="p-3 font-bold text-indigo-600">{p.paymentNumber}</td>
                    <td className="p-3 uppercase text-[10px] text-slate-600">{p.partyType}</td>
                    <td className="p-3 font-sans font-semibold text-slate-800">{p.partyName || '—'}</td>
                    <td className="p-3 uppercase text-[10px] text-slate-600">{p.paymentMethod}</td>
                    <td className="p-3 font-sans text-slate-600">{p.accountName}</td>
                    <td className="p-3 text-right font-bold text-slate-900">
                      {formatCurrency(p.amount, currencyCode, currencySymbol)}
                    </td>
                    <td className="p-3 text-slate-600">{p.reference || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {activeReport !== 'profit_loss' && totalItems > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs print:hidden">
          <div className="text-slate-500">
            Showing <span className="font-semibold text-slate-800">{Math.min(totalItems, (currentPage - 1) * pageSize + 1)}</span> to{' '}
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
                <option value={100}>100</option>
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
    </div>
  );
}

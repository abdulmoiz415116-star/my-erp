'use client';

import React, { useState, useMemo } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  SaleService,
  CustomerService,
  ProductService,
  StockTransactionService,
  PaymentService,
  AccountService,
  AuditLogService,
  validateStockDeduction,
} from '@/services/erp.service';
import {
  SaleInvoice,
  SaleInvoiceItem,
  SaleStatus,
  SaleType,
  Customer,
  Product,
  Account,
} from '@/types/erp';
import { useRealtimeCollection } from '@/hooks/useRealtimeCollection';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  printCommercialInvoice,
  generateWhatsAppInvoiceLink,
  generateEmailInvoiceLink,
} from '@/lib/pdfPrint';
import { generateNextInvoiceNumber } from '@/lib/sequenceGenerator';
import {
  Plus,
  ShoppingCart,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  Trash2,
  Printer,
  Download,
  FileText,
  User,
  Package,
  MessageCircle,
  Mail,
  RotateCcw,
  XCircle,
  Undo2,
  Edit3,
  Filter,
  Calendar,
  Building,
  Search,
  AlertTriangle,
  Send,
} from 'lucide-react';

interface InvoiceDraftItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  taxRate: number;
  discountPercent: number;
  availableStock: number;
}

export default function SalesPage() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { showToast } = useToast();

  const tenantId = currentTenant?.id || 'tenant-apex-corp';
  const currencySymbol = currentTenant?.settings.currencySymbol || '$';
  const currencyCode = currentTenant?.settings.currency || 'USD';

  // Real-time sales collection
  const {
    items: sales,
    allItems: allSales,
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
  } = useRealtimeCollection<SaleInvoice>((tId) => new SaleService(tId), {
    sortBy: 'date',
    sortDirection: 'desc',
  });

  // Supporting real-time collections
  const { allItems: customers } = useRealtimeCollection<Customer>((tId) => new CustomerService(tId));
  const { allItems: products } = useRealtimeCollection<Product>((tId) => new ProductService(tId));
  const { allItems: accounts } = useRealtimeCollection<Account>((tId) => new AccountService(tId));

  // Services for multi-record transactional updates
  const saleService = useMemo(() => new SaleService(tenantId), [tenantId]);
  const stockTxService = useMemo(() => new StockTransactionService(tenantId), [tenantId]);
  const productService = useMemo(() => new ProductService(tenantId), [tenantId]);
  const paymentService = useMemo(() => new PaymentService(tenantId), [tenantId]);
  const accountService = useMemo(() => new AccountService(tenantId), [tenantId]);
  const customerService = useMemo(() => new CustomerService(tenantId), [tenantId]);
  const auditLogService = useMemo(() => new AuditLogService(tenantId), [tenantId]);

  // Tab & Advanced Filter States
  const [lifecycleTab, setLifecycleTab] = useState<'all' | 'posted' | 'draft' | 'void' | 'returned'>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');

  // Modal States
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editDraftModalOpen, setEditDraftModalOpen] = useState(false);
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<SaleInvoice | null>(null);
  const [activeTargetSale, setActiveTargetSale] = useState<SaleInvoice | null>(null);

  // Submit/processing lock to prevent duplicate submissions
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State for New / Draft Invoice
  const [invoiceNumberInput, setInvoiceNumberInput] = useState('');
  const [saleTypeInput, setSaleTypeInput] = useState<SaleType>('cash');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  );
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [lineItems, setLineItems] = useState<InvoiceDraftItem[]>([]);
  const [invoiceDiscountAmount, setInvoiceDiscountAmount] = useState<number>(0);
  const [partialAmount, setPartialAmount] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'credit_card' | 'cheque'>('cash');

  // Void Reason State
  const [voidReasonInput, setVoidReasonInput] = useState('');

  // Return State
  const [returnReasonInput, setReturnReasonInput] = useState('');
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnRefundMethod, setReturnRefundMethod] = useState<'credit_account' | 'cash_refund'>('credit_account');
  const [returnAccountId, setReturnAccountId] = useState('');

  // Quick Collect Payment Modal State
  const [collectPaymentModalOpen, setCollectPaymentModalOpen] = useState(false);
  const [invoiceToCollect, setInvoiceToCollect] = useState<SaleInvoice | null>(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [collectAccountId, setCollectAccountId] = useState('');
  const [collectMethod, setCollectMethod] = useState<'cash' | 'bank_transfer' | 'credit_card' | 'cheque'>('cash');
  const [collectReference, setCollectReference] = useState('');

  // Customer search state for modals
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId);
  }, [customers, selectedCustomerId]);

  const filteredModalCustomers = useMemo(() => {
    const q = customerSearchQuery.trim().toLowerCase();
    const activeList = customers.filter((c) => !c.isDeleted && c.status === 'active');
    if (!q) return activeList;
    return activeList.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.companyName?.toLowerCase().includes(q)
    );
  }, [customers, customerSearchQuery]);

  // Filtered Sales according to tabs & filters
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      // 1. Lifecycle Tab
      const effectiveStatus: SaleStatus = s.saleStatus || 'posted';
      if (lifecycleTab !== 'all' && effectiveStatus !== lifecycleTab) {
        return false;
      }
      // 2. Payment Status
      if (paymentStatusFilter !== 'all' && s.paymentStatus !== paymentStatusFilter) {
        return false;
      }
      // 3. Customer Filter
      if (customerFilter !== 'all' && s.customerId !== customerFilter) {
        return false;
      }
      // 4. Date Range
      if (startDateFilter && new Date(s.date) < new Date(startDateFilter)) {
        return false;
      }
      if (endDateFilter) {
        const end = new Date(endDateFilter);
        end.setHours(23, 59, 59, 999);
        if (new Date(s.date) > end) return false;
      }
      return true;
    });
  }, [sales, lifecycleTab, paymentStatusFilter, customerFilter, startDateFilter, endDateFilter]);

  // High-level KPI Computations (only active posted / returned count towards actual financial totals)
  const stats = useMemo(() => {
    const validSales = allSales.filter(
      (s) => !s.isDeleted && s.saleStatus !== 'draft' && s.saleStatus !== 'void'
    );
    const totalInvoiced = validSales.reduce((acc, s) => acc + (s.totalAmount || 0), 0);
    const totalCollected = validSales.reduce((acc, s) => acc + (s.paidAmount || 0), 0);
    const totalUnpaid = validSales.reduce((acc, s) => acc + (s.balanceAmount || 0), 0);
    const draftCount = allSales.filter((s) => !s.isDeleted && s.saleStatus === 'draft').length;
    const voidCount = allSales.filter((s) => !s.isDeleted && s.saleStatus === 'void').length;

    return {
      totalInvoiced,
      totalCollected,
      totalUnpaid,
      count: validSales.length,
      draftCount,
      voidCount,
    };
  }, [allSales]);

  // Line item and total calculations
  const subtotal = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  }, [lineItems]);

  const lineDiscountsTotal = useMemo(() => {
    return lineItems.reduce((sum, item) => {
      const lineSub = item.quantity * item.unitPrice;
      return sum + (lineSub * (item.discountPercent || 0)) / 100;
    }, 0);
  }, [lineItems]);

  const taxAmount = useMemo(() => {
    return lineItems.reduce((sum, item) => {
      const lineSub = item.quantity * item.unitPrice;
      const lineDiscount = (lineSub * (item.discountPercent || 0)) / 100;
      const taxable = Math.max(0, lineSub - lineDiscount);
      return sum + taxable * (item.taxRate / 100);
    }, 0);
  }, [lineItems]);

  const totalAmount = useMemo(() => {
    const baseAfterDiscount = Math.max(0, subtotal - lineDiscountsTotal - (invoiceDiscountAmount || 0));
    return baseAfterDiscount + taxAmount;
  }, [subtotal, lineDiscountsTotal, invoiceDiscountAmount, taxAmount]);

  const paidAmountCalculated = useMemo(() => {
    if (saleTypeInput === 'credit') return 0;
    if (saleTypeInput === 'cash') return totalAmount;
    const p = parseFloat(partialAmount) || 0;
    return Math.min(p, totalAmount);
  }, [saleTypeInput, partialAmount, totalAmount]);

  const balanceAmountCalculated = useMemo(() => {
    return Math.max(0, totalAmount - paidAmountCalculated);
  }, [totalAmount, paidAmountCalculated]);

  // Form Reset Helper
  const resetForm = () => {
    const nextNum = generateNextInvoiceNumber(
      sales.map((s) => s.invoiceNumber),
      currentTenant?.settings?.invoicePrefix || 'INV-',
      currentTenant?.settings?.invoiceNextNumber || 1001
    );
    setInvoiceNumberInput(nextNum);
    setSaleTypeInput('cash');
    setSelectedCustomerId('');
    setCustomerSearchQuery('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setDueDate(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
    setInvoiceNotes('');
    setLineItems([]);
    setInvoiceDiscountAmount(0);
    setPartialAmount('');
    setSelectedAccountId(accounts[0]?.id || '');
    setPaymentMethod('cash');
  };

  const handleOpenCreateModal = () => {
    resetForm();
    if (accounts.length > 0) {
      const defaultAcc = accounts.find((a) => a.isDefault || a.type === 'cash') || accounts[0];
      setSelectedAccountId(defaultAcc.id);
    }
    setCreateModalOpen(true);
  };

  // Add Item Line to Invoice
  const handleAddItem = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    if (lineItems.some((it) => it.productId === productId)) {
      showToast(`"${product.name}" is already in this invoice. Adjust quantity below.`, 'info');
      return;
    }

    setLineItems((prev) => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: 1,
        unitPrice: product.sellingPrice,
        costPrice: product.costPrice,
        taxRate: product.taxRate || 0,
        discountPercent: 0,
        availableStock: product.currentStock,
      },
    ]);
  };

  const handleUpdateItem = (
    index: number,
    field: 'quantity' | 'unitPrice' | 'discountPercent',
    value: number
  ) => {
    setLineItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };

      if (field === 'quantity') {
        const qty = Math.max(1, value);
        item.quantity = qty;
      } else if (field === 'unitPrice') {
        item.unitPrice = Math.max(0, value);
      } else if (field === 'discountPercent') {
        item.discountPercent = Math.min(100, Math.max(0, value));
      }

      updated[index] = item;
      return updated;
    });
  };

  const handleRemoveItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Create Sale (Draft OR Posted)
  const handleSaveInvoice = async (asDraft: boolean) => {
    if (isSubmitting) return; // Prevent duplicate submission
    if (!selectedCustomerId) {
      showToast('Please select a customer.', 'error');
      return;
    }
    if (lineItems.length === 0) {
      showToast('Invoice must contain at least one product line item.', 'error');
      return;
    }

    // Validation: Quantities & Prices
    for (const it of lineItems) {
      if (it.quantity <= 0) {
        showToast(`Quantity for ${it.productName} must be greater than zero.`, 'error');
        return;
      }
      if (it.unitPrice < 0) {
        showToast(`Price for ${it.productName} cannot be negative.`, 'error');
        return;
      }
    }

    // Validation: Stock check if posting
    if (!asDraft) {
      const allowNegative = currentTenant?.settings.allowNegativeInventory ?? false;
      for (const it of lineItems) {
        const val = validateStockDeduction(it.productName, it.availableStock, it.quantity, allowNegative);
        if (!val.isValid) {
          showToast(val.error || `Insufficient stock for ${it.productName}.`, 'error');
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const customer = customers.find((c) => c.id === selectedCustomerId);
      const customerName = customer ? customer.name : 'Valued Customer';
      const targetAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0];

      const invNumber =
        invoiceNumberInput.trim() ||
        generateNextInvoiceNumber(
          sales.map((s) => s.invoiceNumber),
          currentTenant?.settings?.invoicePrefix || 'INV-',
          currentTenant?.settings?.invoiceNextNumber || 1001
        );

      const invoiceItems: SaleInvoiceItem[] = lineItems.map((it) => {
        const lineSub = it.quantity * it.unitPrice;
        const lineDisc = (lineSub * (it.discountPercent || 0)) / 100;
        const taxable = Math.max(0, lineSub - lineDisc);
        const lineTax = (taxable * it.taxRate) / 100;
        return {
          productId: it.productId,
          productName: it.productName,
          sku: it.sku,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          costPrice: it.costPrice,
          taxRate: it.taxRate,
          discountPercent: it.discountPercent,
          discountAmount: lineDisc,
          subtotal: lineSub,
          total: taxable + lineTax,
        };
      });

      const totalDiscount = lineDiscountsTotal + (invoiceDiscountAmount || 0);

      // 1. Create Sale Document
      const saleData: any = {
        invoiceNumber: invNumber,
        customerId: selectedCustomerId,
        customerName,
        date: invoiceDate,
        dueDate: dueDate || invoiceDate,
        items: invoiceItems,
        subtotal,
        taxAmount,
        discountAmount: totalDiscount,
        totalAmount,
        paidAmount: asDraft ? 0 : paidAmountCalculated,
        balanceAmount: asDraft ? totalAmount : balanceAmountCalculated,
        paymentStatus: asDraft ? 'unpaid' : paidAmountCalculated >= totalAmount ? 'paid' : paidAmountCalculated > 0 ? 'partial' : 'unpaid',
        saleStatus: asDraft ? 'draft' : 'posted',
        saleType: saleTypeInput,
        paymentMethod: saleTypeInput !== 'credit' ? paymentMethod : undefined,
        accountId: saleTypeInput !== 'credit' ? targetAccount?.id : undefined,
        accountName: saleTypeInput !== 'credit' ? targetAccount?.accountName : undefined,
        notes: invoiceNotes,
        status: 'active',
      };

      const createdInvoice = await saleService.create(saleData);

      // 2. If POSTED, execute Real-time Business Invariants
      if (!asDraft) {
        // Decrement Product Stock and log immutable Stock Transactions
        for (const it of lineItems) {
          await stockTxService.create({
            productId: it.productId,
            productName: it.productName,
            sku: it.sku,
            quantity: it.quantity,
            direction: 'out',
            type: 'sale',
            reference: invNumber,
            referenceType: 'sale',
            date: invoiceDate,
            cost: it.costPrice,
            totalCost: it.costPrice * it.quantity,
            userId: user?.uid || 'system',
            userName: user?.displayName || 'Sales Officer',
            location: 'Main Warehouse',
            notes: `Commercial Sale Invoice #${invNumber} to ${customerName}`,
          });

          // Atomically decrement current stock
          const currentProd = products.find((p) => p.id === it.productId);
          if (currentProd) {
            await productService.update(it.productId, {
              currentStock: Math.max(0, currentProd.currentStock - it.quantity),
            });
          }
        }

        // Record Payment & Deposit into Account if paid amount > 0
        if (paidAmountCalculated > 0 && targetAccount) {
          const paymentNumber = `PAY-${Math.floor(10000 + Math.random() * 90000)}`;
          await paymentService.create({
            paymentNumber,
            partyType: 'customer',
            partyId: selectedCustomerId,
            partyName: customerName,
            type: 'receipt',
            amount: paidAmountCalculated,
            date: invoiceDate,
            accountId: targetAccount.id,
            accountName: targetAccount.accountName,
            paymentMethod,
            reference: invNumber,
            notes: `Payment for Sale Invoice #${invNumber}`,
            status: 'active',
          });

          // Deposit funds into Account
          await accountService.update(targetAccount.id, {
            currentBalance: (targetAccount.currentBalance || 0) + paidAmountCalculated,
          });
        }

        // Real-time update to Customer Outstanding balance if credit/unpaid balance exists
        if (balanceAmountCalculated > 0 && customer) {
          await customerService.update(customer.id, {
            currentBalance: (customer.currentBalance || 0) + balanceAmountCalculated,
          });
        }
      }

      // Record immutable audit log for Sale
      await auditLogService.create({
        action: asDraft ? 'CREATE' : 'POST',
        module: 'sales',
        recordId: invNumber,
        entityId: invNumber,
        entityName: customerName,
        description: asDraft
          ? `Created draft Sales Invoice #${invNumber} for ${customerName}`
          : `Posted Sales Invoice #${invNumber} for ${customerName} (${formatCurrency(totalAmount, currencyCode, currencySymbol)})`,
        newValue: {
          invoiceNumber: invNumber,
          customerName,
          totalAmount,
          paidAmount: asDraft ? 0 : paidAmountCalculated,
          balanceAmount: asDraft ? totalAmount : balanceAmountCalculated,
          saleStatus: asDraft ? 'draft' : 'posted',
        },
        userId: user?.uid || 'system',
        userName: user?.displayName || 'Sales Officer',
        userEmail: user?.email || 'sales@erp.local',
        timestamp: new Date().toISOString(),
      });

      setCreateModalOpen(false);
      showToast(
        asDraft
          ? `Invoice #${invNumber} saved as draft.`
          : `Invoice #${invNumber} posted successfully! Inventory and accounts updated.`,
        'success'
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to save sales invoice.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Draft Modal
  const handleOpenEditDraft = (invoice: SaleInvoice) => {
    if (invoice.saleStatus !== 'draft') {
      showToast('Only draft sales can be modified. Posted sales must be voided or returned.', 'warning');
      return;
    }
    setActiveTargetSale(invoice);
    setInvoiceNumberInput(invoice.invoiceNumber);
    setSelectedCustomerId(invoice.customerId);
    setInvoiceDate(invoice.date.split('T')[0]);
    setDueDate(invoice.dueDate ? invoice.dueDate.split('T')[0] : '');
    setInvoiceNotes(invoice.notes || '');
    setInvoiceDiscountAmount(invoice.discountAmount || 0);
    setSaleTypeInput(invoice.saleType || 'cash');

    const mappedItems: InvoiceDraftItem[] = invoice.items.map((it) => {
      const prod = products.find((p) => p.id === it.productId);
      return {
        productId: it.productId,
        productName: it.productName,
        sku: it.sku,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        costPrice: it.costPrice,
        taxRate: it.taxRate,
        discountPercent: it.discountPercent || 0,
        availableStock: prod ? prod.currentStock : 0,
      };
    });
    setLineItems(mappedItems);
    setEditDraftModalOpen(true);
  };

  // Update Draft or Post Draft
  const handleUpdateDraft = async (postNow: boolean) => {
    if (!activeTargetSale || isSubmitting) return;

    if (!selectedCustomerId) {
      showToast('Please select a customer.', 'error');
      return;
    }
    if (lineItems.length === 0) {
      showToast('Invoice must contain at least one line item.', 'error');
      return;
    }

    if (postNow) {
      const allowNegative = currentTenant?.settings.allowNegativeInventory ?? false;
      for (const it of lineItems) {
        const val = validateStockDeduction(it.productName, it.availableStock, it.quantity, allowNegative);
        if (!val.isValid) {
          showToast(val.error || `Insufficient stock for ${it.productName}.`, 'error');
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const customer = customers.find((c) => c.id === selectedCustomerId);
      const customerName = customer ? customer.name : 'Valued Customer';
      const targetAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0];

      const invoiceItems: SaleInvoiceItem[] = lineItems.map((it) => {
        const lineSub = it.quantity * it.unitPrice;
        const lineDisc = (lineSub * (it.discountPercent || 0)) / 100;
        const taxable = Math.max(0, lineSub - lineDisc);
        const lineTax = (taxable * it.taxRate) / 100;
        return {
          productId: it.productId,
          productName: it.productName,
          sku: it.sku,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          costPrice: it.costPrice,
          taxRate: it.taxRate,
          discountPercent: it.discountPercent,
          discountAmount: lineDisc,
          subtotal: lineSub,
          total: taxable + lineTax,
        };
      });

      const totalDiscount = lineDiscountsTotal + (invoiceDiscountAmount || 0);

      const updateData: any = {
        invoiceNumber: invoiceNumberInput.trim() || activeTargetSale.invoiceNumber,
        customerId: selectedCustomerId,
        customerName,
        date: invoiceDate,
        dueDate: dueDate || invoiceDate,
        items: invoiceItems,
        subtotal,
        taxAmount,
        discountAmount: totalDiscount,
        totalAmount,
        paidAmount: postNow ? paidAmountCalculated : 0,
        balanceAmount: postNow ? balanceAmountCalculated : totalAmount,
        paymentStatus: postNow ? (paidAmountCalculated >= totalAmount ? 'paid' : paidAmountCalculated > 0 ? 'partial' : 'unpaid') : 'unpaid',
        saleStatus: postNow ? 'posted' : 'draft',
        saleType: saleTypeInput,
        notes: invoiceNotes,
      };

      await saleService.update(activeTargetSale.id, updateData);

      // If posting now, trigger stock and account updates
      if (postNow) {
        for (const it of lineItems) {
          await stockTxService.create({
            productId: it.productId,
            productName: it.productName,
            sku: it.sku,
            quantity: it.quantity,
            direction: 'out',
            type: 'sale',
            reference: activeTargetSale.invoiceNumber,
            referenceType: 'sale',
            date: invoiceDate,
            cost: it.costPrice,
            totalCost: it.costPrice * it.quantity,
            userId: user?.uid || 'system',
            userName: user?.displayName || 'Sales Officer',
            location: 'Main Warehouse',
            notes: `Draft converted to Posted Sale #${activeTargetSale.invoiceNumber}`,
          });

          const currentProd = products.find((p) => p.id === it.productId);
          if (currentProd) {
            await productService.update(it.productId, {
              currentStock: Math.max(0, currentProd.currentStock - it.quantity),
            });
          }
        }

        if (paidAmountCalculated > 0 && targetAccount) {
          const paymentNumber = `PAY-${Math.floor(10000 + Math.random() * 90000)}`;
          await paymentService.create({
            paymentNumber,
            partyType: 'customer',
            partyId: selectedCustomerId,
            partyName: customerName,
            type: 'receipt',
            amount: paidAmountCalculated,
            date: invoiceDate,
            accountId: targetAccount.id,
            accountName: targetAccount.accountName,
            paymentMethod,
            reference: activeTargetSale.invoiceNumber,
            notes: `Payment for Sale Invoice #${activeTargetSale.invoiceNumber}`,
            status: 'active',
          });

          await accountService.update(targetAccount.id, {
            currentBalance: (targetAccount.currentBalance || 0) + paidAmountCalculated,
          });
        }

        // Real-time update to Customer Outstanding balance if credit/unpaid balance exists
        if (balanceAmountCalculated > 0 && customer) {
          await customerService.update(customer.id, {
            currentBalance: (customer.currentBalance || 0) + balanceAmountCalculated,
          });
        }
      }

      // Record immutable audit log
      await auditLogService.create({
        action: postNow ? 'POST' : 'UPDATE',
        module: 'sales',
        recordId: activeTargetSale.invoiceNumber,
        entityId: activeTargetSale.invoiceNumber,
        entityName: customerName,
        description: postNow
          ? `Posted Draft Sales Invoice #${activeTargetSale.invoiceNumber} for ${customerName}`
          : `Updated Draft Sales Invoice #${activeTargetSale.invoiceNumber}`,
        previousValue: {
          saleStatus: activeTargetSale.saleStatus,
          totalAmount: activeTargetSale.totalAmount,
        },
        newValue: {
          saleStatus: postNow ? 'posted' : 'draft',
          totalAmount,
          paidAmount: postNow ? paidAmountCalculated : 0,
          balanceAmount: postNow ? balanceAmountCalculated : totalAmount,
        },
        userId: user?.uid || 'system',
        userName: user?.displayName || 'Sales Officer',
        userEmail: user?.email || 'sales@erp.local',
        timestamp: new Date().toISOString(),
      });

      setEditDraftModalOpen(false);
      setActiveTargetSale(null);
      showToast(
        postNow
          ? `Invoice #${activeTargetSale.invoiceNumber} posted successfully!`
          : `Draft #${activeTargetSale.invoiceNumber} updated.`,
        'success'
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to update draft.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Quick Collect Payment Modal on Invoice
  const handleOpenCollectPaymentModal = (invoice: SaleInvoice) => {
    if (invoice.saleStatus === 'void' || invoice.saleStatus === 'draft') {
      showToast('Cannot collect payment on draft or voided invoices.', 'info');
      return;
    }
    if (invoice.balanceAmount <= 0) {
      showToast('This invoice is already paid in full.', 'info');
      return;
    }
    setInvoiceToCollect(invoice);
    setCollectAmount(invoice.balanceAmount.toString());
    const activeAccs = accounts.filter((a) => a.status === 'active' && !a.isDeleted);
    setCollectAccountId(activeAccs[0]?.id || '');
    setCollectMethod('cash');
    setCollectReference(`RCPT-${invoice.invoiceNumber}`);
    setCollectPaymentModalOpen(true);
  };

  // Confirm Quick Collect Payment
  const handleConfirmCollectPayment = async () => {
    if (!invoiceToCollect || isSubmitting) return;
    const parsed = parseFloat(collectAmount);
    if (!parsed || parsed <= 0) {
      showToast('Please enter a valid payment amount greater than 0.', 'error');
      return;
    }
    if (parsed > invoiceToCollect.balanceAmount) {
      showToast(
        `Amount cannot exceed outstanding balance of ${formatCurrency(invoiceToCollect.balanceAmount, currencyCode, currencySymbol)}.`,
        'error'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const nowStr = new Date().toISOString();
      const targetAcc = accounts.find((a) => a.id === collectAccountId) || accounts[0];
      const rcptNum = `RCPT-${Date.now().toString().slice(-5)}`;

      // 1. Auto-generate Payment receipt in Payment Ledger
      await paymentService.create({
        paymentNumber: rcptNum,
        partyType: 'customer',
        partyId: invoiceToCollect.customerId,
        partyName: invoiceToCollect.customerName,
        type: 'receipt',
        amount: parsed,
        date: nowStr.split('T')[0],
        accountId: targetAcc ? targetAcc.id : 'acc-001',
        accountName: targetAcc ? targetAcc.accountName : 'Cash / Till',
        paymentMethod: collectMethod,
        reference: collectReference || invoiceToCollect.invoiceNumber,
        invoiceId: invoiceToCollect.id,
        invoiceNumber: invoiceToCollect.invoiceNumber,
        notes: `Direct collection on Invoice #${invoiceToCollect.invoiceNumber}`,
        status: 'active',
      });

      // 2. Deposit into Account
      if (targetAcc) {
        await accountService.update(targetAcc.id, {
          currentBalance: (targetAcc.currentBalance || 0) + parsed,
        });
      }

      // 3. Update Invoice
      const newPaid = (invoiceToCollect.paidAmount || 0) + parsed;
      const newBalance = Math.max(0, invoiceToCollect.totalAmount - newPaid);
      const newStatus = newBalance <= 0.01 ? 'paid' : 'partial';

      await saleService.update(invoiceToCollect.id, {
        paidAmount: newPaid,
        balanceAmount: newBalance,
        paymentStatus: newStatus,
      });

      // 4. Update Customer Ledger Balance
      const cust = customers.find((c) => c.id === invoiceToCollect.customerId);
      if (cust) {
        await customerService.update(cust.id, {
          currentBalance: Math.max(0, (cust.currentBalance || 0) - parsed),
        });
      }

      // 5. Immutable Audit Log
      await auditLogService.create({
        action: 'PAYMENT',
        module: 'Sales',
        entityId: invoiceToCollect.invoiceNumber,
        entityName: invoiceToCollect.customerName,
        description: `Collected ${formatCurrency(parsed, currencyCode, currencySymbol)} on Invoice #${invoiceToCollect.invoiceNumber}. Deposited to ${targetAcc?.accountName || 'Cash Account'}`,
        userId: user?.uid || 'system',
        userName: user?.displayName || 'Sales Officer',
        userEmail: user?.email || 'admin@erp.com',
        timestamp: nowStr,
      });

      showToast(`Receipt of ${formatCurrency(parsed, currencyCode, currencySymbol)} recorded and synced!`, 'success');
      setCollectPaymentModalOpen(false);
      if (viewInvoice?.id === invoiceToCollect.id) {
        setViewInvoice({
          ...viewInvoice,
          paidAmount: newPaid,
          balanceAmount: newBalance,
          paymentStatus: newStatus,
        });
      }
      setInvoiceToCollect(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to record payment.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Void Modal
  const handleOpenVoidModal = (invoice: SaleInvoice) => {
    if (invoice.saleStatus === 'void') {
      showToast('This sale is already voided.', 'info');
      return;
    }
    setActiveTargetSale(invoice);
    setVoidReasonInput('');
    setVoidModalOpen(true);
  };

  // Confirm Void / Cancel Sale with Full Invariant Reversals
  const handleConfirmVoid = async () => {
    if (!activeTargetSale || isSubmitting) return;
    if (!voidReasonInput.trim()) {
      showToast('Please provide a reason for cancelling this sale.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const nowStr = new Date().toISOString();

      // 1. If sale was posted, reverse stock back to warehouse
      if (activeTargetSale.saleStatus === 'posted' || !activeTargetSale.saleStatus) {
        for (const it of activeTargetSale.items) {
          // Offsetting Inward Stock Transaction
          await stockTxService.create({
            productId: it.productId,
            productName: it.productName,
            sku: it.sku,
            quantity: it.quantity,
            direction: 'in',
            type: 'adjustment_in',
            reference: `VOID-${activeTargetSale.invoiceNumber}`,
            referenceType: 'stock_adjustment',
            date: nowStr,
            cost: it.costPrice,
            totalCost: it.costPrice * it.quantity,
            userId: user?.uid || 'system',
            userName: user?.displayName || 'Admin',
            location: 'Main Warehouse',
            notes: `Inventory restored due to cancellation of Sale #${activeTargetSale.invoiceNumber}. Reason: ${voidReasonInput}`,
          });

          // Restock product quantity
          const currentProd = products.find((p) => p.id === it.productId);
          if (currentProd) {
            await productService.update(it.productId, {
              currentStock: (currentProd.currentStock || 0) + it.quantity,
            });
          }
        }

        // 2. If payments were received, record refund disbursement from Account
        if (activeTargetSale.paidAmount > 0) {
          const targetAcc =
            accounts.find((a) => a.id === activeTargetSale.accountId) ||
            accounts.find((a) => a.type === 'cash' || a.isDefault) ||
            accounts[0];

          if (targetAcc) {
            const refundNumber = `REF-${Math.floor(10000 + Math.random() * 90000)}`;
            await paymentService.create({
              paymentNumber: refundNumber,
              partyType: 'customer',
              partyId: activeTargetSale.customerId,
              partyName: activeTargetSale.customerName,
              type: 'payment', // Outward refund
              amount: activeTargetSale.paidAmount,
              date: nowStr,
              accountId: targetAcc.id,
              accountName: targetAcc.accountName,
              paymentMethod: 'cash',
              reference: `VOID-${activeTargetSale.invoiceNumber}`,
              notes: `Refund issued for cancelled sale #${activeTargetSale.invoiceNumber}. Reason: ${voidReasonInput}`,
              status: 'active',
            });

            await accountService.update(targetAcc.id, {
              currentBalance: Math.max(0, (targetAcc.currentBalance || 0) - activeTargetSale.paidAmount),
            });
          }
        }

        // 3. If invoice had an unpaid balance, reverse customer receivable balance
        if (activeTargetSale.balanceAmount > 0) {
          const cust = customers.find((c) => c.id === activeTargetSale.customerId);
          if (cust) {
            await customerService.update(cust.id, {
              currentBalance: Math.max(0, (cust.currentBalance || 0) - activeTargetSale.balanceAmount),
            });
          }
        }
      }

      // 4. Mark Sale as VOID
      await saleService.update(activeTargetSale.id, {
        saleStatus: 'void',
        voidReason: voidReasonInput,
        voidDate: nowStr,
        notes: `${activeTargetSale.notes ? activeTargetSale.notes + ' | ' : ''}VOIDED on ${formatDate(nowStr)}. Reason: ${voidReasonInput}`,
      });

      // Record immutable audit log
      await auditLogService.create({
        action: 'CANCEL',
        module: 'sales',
        recordId: activeTargetSale.invoiceNumber,
        entityId: activeTargetSale.invoiceNumber,
        entityName: activeTargetSale.customerName,
        description: `Voided / Cancelled Sale Invoice #${activeTargetSale.invoiceNumber}. Reason: ${voidReasonInput}`,
        previousValue: {
          saleStatus: activeTargetSale.saleStatus,
          totalAmount: activeTargetSale.totalAmount,
          paidAmount: activeTargetSale.paidAmount,
          balanceAmount: activeTargetSale.balanceAmount,
        },
        newValue: {
          saleStatus: 'void',
          voidReason: voidReasonInput,
          voidDate: nowStr,
        },
        userId: user?.uid || 'system',
        userName: user?.displayName || 'Admin',
        userEmail: user?.email || 'admin@erp.local',
        timestamp: nowStr,
      });

      setVoidModalOpen(false);
      if (viewInvoice?.id === activeTargetSale.id) {
        setViewInvoice(null);
      }
      setActiveTargetSale(null);
      showToast(
        `Sale #${activeTargetSale.invoiceNumber} has been voided. Stock and financial balances reversed.`,
        'success'
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to void sale.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Return Modal
  const handleOpenReturnModal = (invoice: SaleInvoice) => {
    if (invoice.saleStatus === 'void' || invoice.saleStatus === 'draft') {
      showToast('Returns can only be processed on posted sales.', 'error');
      return;
    }
    setActiveTargetSale(invoice);
    setReturnReasonInput('');
    setReturnQuantities({});
    setReturnRefundMethod('credit_account');
    setReturnAccountId(accounts[0]?.id || '');
    setReturnModalOpen(true);
  };

  // Confirm Sale Return
  const handleConfirmReturn = async () => {
    if (!activeTargetSale || isSubmitting) return;

    const returnItemsList = Object.entries(returnQuantities).filter(([_, qty]) => qty > 0);
    if (returnItemsList.length === 0) {
      showToast('Please specify return quantity for at least one item.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const nowStr = new Date().toISOString();
      let totalReturnValue = 0;

      const updatedItems: SaleInvoiceItem[] = activeTargetSale.items.map((it) => {
        const qtyToReturn = returnQuantities[it.productId] || 0;
        if (qtyToReturn > 0) {
          const itemUnitTotal = it.unitPrice * (1 - (it.discountPercent || 0) / 100) * (1 + it.taxRate / 100);
          totalReturnValue += itemUnitTotal * qtyToReturn;
        }
        return {
          ...it,
          returnedQuantity: (it.returnedQuantity || 0) + qtyToReturn,
        };
      });

      // 1. Log Stock Return and restore inventory
      for (const [prodId, returnQty] of returnItemsList) {
        const it = activeTargetSale.items.find((i) => i.productId === prodId);
        if (!it) continue;

        await stockTxService.create({
          productId: prodId,
          productName: it.productName,
          sku: it.sku,
          quantity: returnQty,
          direction: 'in',
          type: 'sale_return',
          reference: `RET-${activeTargetSale.invoiceNumber}`,
          referenceType: 'sale_return',
          date: nowStr,
          cost: it.costPrice,
          totalCost: it.costPrice * returnQty,
          userId: user?.uid || 'system',
          userName: user?.displayName || 'Staff',
          location: 'Main Warehouse',
          notes: `Customer Sale Return for #${activeTargetSale.invoiceNumber}. Reason: ${returnReasonInput}`,
        });

        const currentProd = products.find((p) => p.id === prodId);
        if (currentProd) {
          await productService.update(prodId, {
            currentStock: (currentProd.currentStock || 0) + returnQty,
          });
        }
      }

      // 2. Process Refund or Account Credit
      if (returnRefundMethod === 'cash_refund') {
        const targetAcc = accounts.find((a) => a.id === returnAccountId) || accounts[0];
        if (targetAcc && totalReturnValue > 0) {
          const refundNum = `PAY-RET-${Math.floor(10000 + Math.random() * 90000)}`;
          await paymentService.create({
            paymentNumber: refundNum,
            partyType: 'customer',
            partyId: activeTargetSale.customerId,
            partyName: activeTargetSale.customerName,
            type: 'payment',
            amount: totalReturnValue,
            date: nowStr,
            accountId: targetAcc.id,
            accountName: targetAcc.accountName,
            paymentMethod: 'cash',
            reference: `RET-${activeTargetSale.invoiceNumber}`,
            notes: `Cash refund for returned items on #${activeTargetSale.invoiceNumber}`,
            status: 'active',
          });

          await accountService.update(targetAcc.id, {
            currentBalance: Math.max(0, (targetAcc.currentBalance || 0) - totalReturnValue),
          });
        }
      } else {
        // Store Credit / Account balance adjustment: Reduce customer receivable debt
        const cust = customers.find((c) => c.id === activeTargetSale.customerId);
        if (cust && totalReturnValue > 0) {
          await customerService.update(cust.id, {
            currentBalance: Math.max(0, (cust.currentBalance || 0) - totalReturnValue),
          });
        }
      }

      // 3. Update Sale Document
      const updatedBalanceDue = returnRefundMethod === 'cash_refund'
        ? (activeTargetSale.balanceAmount || 0)
        : Math.max(0, (activeTargetSale.balanceAmount || 0) - totalReturnValue);

      await saleService.update(activeTargetSale.id, {
        items: updatedItems,
        saleStatus: 'returned',
        balanceAmount: updatedBalanceDue,
        returnReason: returnReasonInput,
        returnDate: nowStr,
        notes: `${activeTargetSale.notes ? activeTargetSale.notes + ' | ' : ''}Items returned on ${formatDate(nowStr)}. Value: ${formatCurrency(totalReturnValue, currencyCode, currencySymbol)}`,
      });

      setReturnModalOpen(false);
      setActiveTargetSale(null);
      if (viewInvoice?.id === activeTargetSale.id) {
        setViewInvoice(null);
      }
      showToast(
        `Sale return processed! Inventory restocked for returned units.`,
        'success'
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to process return.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (inv: SaleInvoice) => {
    const status: SaleStatus = inv.saleStatus || 'posted';
    if (status === 'draft') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
          <Clock className="w-3 h-3" /> Draft
        </span>
      );
    }
    if (status === 'void') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
          <XCircle className="w-3 h-3" /> Cancelled / Void
        </span>
      );
    }
    if (status === 'returned') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300">
          <Undo2 className="w-3 h-3" /> Returned
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
        <CheckCircle2 className="w-3 h-3" /> Posted
      </span>
    );
  };

  // Payment Badge Helper
  const renderPaymentBadge = (inv: SaleInvoice) => {
    if (inv.saleStatus === 'void') {
      return <span className="text-xs text-slate-400 font-mono italic">Reversed</span>;
    }
    if (inv.paymentStatus === 'paid') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" /> Paid
        </span>
      );
    }
    if (inv.paymentStatus === 'partial') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3 h-3" /> Partial
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
        <AlertCircle className="w-3 h-3" /> Unpaid
      </span>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Sales & Invoicing Management"
        description="Comprehensive commercial sales lifecycle: Draft, Posting, Cancellation/Void with full balance reversals, and Returns."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Sales' },
        ]}
        actions={
          <Button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Create New Sale
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Invoiced
            </span>
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-2 font-mono">
            {formatCurrency(stats.totalInvoiced, currencyCode, currencySymbol)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{stats.count} posted sales</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Collected
            </span>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-600 mt-2 font-mono">
            {formatCurrency(stats.totalCollected, currencyCode, currencySymbol)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Cash & bank collections</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Receivables Due
            </span>
            <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-rose-600 mt-2 font-mono">
            {formatCurrency(stats.totalUnpaid, currencyCode, currencySymbol)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Pending customer balance</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Draft Estimates
            </span>
            <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-800 mt-2 font-mono">
            {stats.draftCount}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Unposted quotations</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Voided / Reversals
            </span>
            <div className="p-2 bg-rose-50 rounded-lg text-rose-600">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-700 mt-2 font-mono">
            {stats.voidCount}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Audit-tracked cancellations</p>
        </div>
      </div>

      {/* FILTER CONTROLS & LIFECYCLE TABS */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-4 space-y-4">
        {/* Top: Lifecycle Status Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setLifecycleTab('all')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                lifecycleTab === 'all'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Invoices ({allSales.length})
            </button>
            <button
              onClick={() => setLifecycleTab('posted')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                lifecycleTab === 'posted'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Posted / Final ({allSales.filter((s) => !s.saleStatus || s.saleStatus === 'posted').length})
            </button>
            <button
              onClick={() => setLifecycleTab('draft')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                lifecycleTab === 'draft'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Drafts ({allSales.filter((s) => s.saleStatus === 'draft').length})
            </button>
            <button
              onClick={() => setLifecycleTab('returned')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                lifecycleTab === 'returned'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Returned ({allSales.filter((s) => s.saleStatus === 'returned').length})
            </button>
            <button
              onClick={() => setLifecycleTab('void')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                lifecycleTab === 'void'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cancelled / Void ({allSales.filter((s) => s.saleStatus === 'void').length})
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search Invoice #, customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Secondary Filter Row: Date Range, Customer, Payment Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Customer Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Filter by Customer
            </label>
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="w-full py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Customers</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Status Filter */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Payment Status
            </label>
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value as any)}
              className="w-full py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Payment Statuses</option>
              <option value="paid">Paid in Full</option>
              <option value="partial">Partially Paid</option>
              <option value="unpaid">Unpaid / On Credit</option>
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className="w-full py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              className="w-full py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            />
          </div>
        </div>
      </div>

      {/* SALES DATA TABLE */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Lifecycle</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
                <th className="py-3 px-4 text-right">Balance Due</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-sans">
                    <ShoppingCart className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                    <p className="text-sm font-medium text-slate-600">No sales match your active filters</p>
                    <p className="text-xs text-slate-400 mt-0.5">Try adjusting your status tabs or date range.</p>
                  </td>
                </tr>
              ) : (
                filteredSales.map((inv) => {
                  const effectiveStatus: SaleStatus = inv.saleStatus || 'posted';
                  const isVoid = effectiveStatus === 'void';
                  const isDraft = effectiveStatus === 'draft';
                  const targetCust = customers.find((c) => c.id === inv.customerId);

                  return (
                    <tr
                      key={inv.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isVoid ? 'bg-rose-50/30 opacity-75' : isDraft ? 'bg-slate-50/40' : ''
                      }`}
                    >
                      {/* Invoice Number */}
                      <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                        <span className={isVoid ? 'line-through text-slate-500' : ''}>
                          {inv.invoiceNumber}
                        </span>
                        {inv.saleType && (
                          <span className="block text-[10px] font-normal text-slate-400 uppercase">
                            {inv.saleType} sale
                          </span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {formatDate(inv.date)}
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-4 font-sans font-medium text-slate-800 whitespace-nowrap">
                        {inv.customerName}
                      </td>

                      {/* Lifecycle Status */}
                      <td className="py-3 px-4 font-sans whitespace-nowrap">
                        {renderStatusBadge(inv)}
                      </td>

                      {/* Grand Total */}
                      <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                        <span className={isVoid ? 'line-through text-slate-400' : ''}>
                          {formatCurrency(inv.totalAmount, currencyCode, currencySymbol)}
                        </span>
                      </td>

                      {/* Balance Due */}
                      <td className="py-3 px-4 text-right font-bold whitespace-nowrap">
                        {isVoid ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          <span className={inv.balanceAmount > 0 ? 'text-rose-600' : 'text-slate-500'}>
                            {formatCurrency(inv.balanceAmount, currencyCode, currencySymbol)}
                          </span>
                        )}
                      </td>

                      {/* Payment Status */}
                      <td className="py-3 px-4 font-sans whitespace-nowrap">
                        {renderPaymentBadge(inv)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right font-sans whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setViewInvoice(inv)}
                            title="View Invoice Details"
                          >
                            <Eye className="w-4 h-4 text-slate-600" />
                          </Button>
                          {/* Quick Collect Payment on Invoice with Balance Due */}
                          {inv.balanceAmount > 0 && !isVoid && !isDraft && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenCollectPaymentModal(inv)}
                              title={`Collect Payment (${formatCurrency(inv.balanceAmount, currencyCode, currencySymbol)} due)`}
                              className="text-emerald-600 hover:bg-emerald-50"
                            >
                              <DollarSign className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => printCommercialInvoice(inv, currentTenant)}
                            title="Print or Save PDF"
                          >
                            <Printer className="w-4 h-4 text-indigo-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              window.open(
                                generateWhatsAppInvoiceLink(inv, targetCust?.phone, currentTenant?.name),
                                '_blank'
                              )
                            }
                            title="Send via WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4 text-emerald-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              (window.location.href = generateEmailInvoiceLink(
                                inv,
                                targetCust?.email,
                                currentTenant?.name
                              ))
                            }
                            title="Send via Email"
                          >
                            <Mail className="w-4 h-4 text-blue-600" />
                          </Button>

                          {/* Edit Draft only if draft */}
                          {isDraft && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenEditDraft(inv)}
                              title="Edit Draft Quotation"
                            >
                              <Edit3 className="w-4 h-4 text-amber-600" />
                            </Button>
                          )}

                          {/* Cancel / Void Sale (Only posted or returned sales, strictly cannot hard delete) */}
                          {!isVoid && !isDraft && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenVoidModal(inv)}
                              title="Cancel / Void Posted Sale"
                            >
                              <XCircle className="w-4 h-4 text-rose-500" />
                            </Button>
                          )}

                          {/* Sale Return (Allowed for posted sales with remaining returned capacity) */}
                          {!isVoid && !isDraft && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenReturnModal(inv)}
                              title="Customer Return"
                            >
                              <Undo2 className="w-4 h-4 text-purple-600" />
                            </Button>
                          )}

                          {/* Hard Delete only allowed for draft sales */}
                          {isDraft && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`Discard draft ${inv.invoiceNumber}?`)) {
                                  softDeleteItem(inv.id);
                                  showToast(`Draft ${inv.invoiceNumber} removed.`, 'info');
                                }
                              }}
                              title="Delete Draft"
                            >
                              <Trash2 className="w-4 h-4 text-slate-400 hover:text-rose-500" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE NEW SALE MODAL */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create New Sales Invoice"
        size="lg"
      >
        <div className="space-y-4">
          {/* Header Row: Invoice #, Sale Type, Customer, Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Invoice Number
              </label>
              <Input
                value={invoiceNumberInput}
                onChange={(e) => setInvoiceNumberInput(e.target.value)}
                placeholder="INV-XXXX"
                className="font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sale Type
              </label>
              <select
                value={saleTypeInput}
                onChange={(e) => setSaleTypeInput(e.target.value as SaleType)}
                className="w-full py-2 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="cash">Cash Sale (Immediate Full Pay)</option>
                <option value="credit">Credit Sale (Unpaid on Account)</option>
                <option value="partial">Partial Payment (Split)</option>
              </select>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">
                  Customer *
                </label>
                {customerSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setCustomerSearchQuery('')}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by name, phone, code..."
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
              </div>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full mt-1 py-2 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="">-- Choose Customer ({filteredModalCustomers.length}) --</option>
                {filteredModalCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ''} {c.phone ? `• ${c.phone}` : ''} (Bal: {formatCurrency(c.currentBalance, currencyCode, currencySymbol)})
                  </option>
                ))}
              </select>
              {selectedCustomer && (
                <div className="mt-1 px-2 py-1 bg-indigo-50 border border-indigo-100 rounded text-[11px] flex items-center justify-between">
                  <span className="font-semibold text-indigo-900 truncate">
                    {selectedCustomer.name} {selectedCustomer.phone ? `(${selectedCustomer.phone})` : ''}
                  </span>
                  <span className="font-mono text-rose-600 font-bold shrink-0 ml-1">
                    Due: {formatCurrency(selectedCustomer.currentBalance, currencyCode, currencySymbol)}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Invoice Date
              </label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>

          {/* Product Quick-Add Bar */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Add Products to Order
            </label>
            <div className="flex gap-2">
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddItem(e.target.value);
                    e.target.value = '';
                  }
                }}
                defaultValue=""
                className="flex-1 py-2 px-3 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              >
                <option value="" disabled>
                  Click here to select a catalog product to add...
                </option>
                {products
                  .filter((p) => !p.isDeleted && p.status === 'active')
                  .map((p) => (
                    <option key={p.id} value={p.id} disabled={p.currentStock <= 0}>
                      {p.name} [{p.sku}] — In Stock: {p.currentStock} {p.unit} — Price:{' '}
                      {formatCurrency(p.sellingPrice, currencyCode, currencySymbol)}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5 w-10 text-center">#</th>
                  <th className="p-2.5">Product Description</th>
                  <th className="p-2.5 w-24 text-center">Stock</th>
                  <th className="p-2.5 w-24 text-center">Quantity</th>
                  <th className="p-2.5 w-28 text-right">Price ({currencyCode})</th>
                  <th className="p-2.5 w-24 text-center">Disc (%)</th>
                  <th className="p-2.5 w-20 text-center">Tax</th>
                  <th className="p-2.5 w-28 text-right">Line Total</th>
                  <th className="p-2.5 w-12 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {lineItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400 font-sans">
                      No items added yet. Choose a product above.
                    </td>
                  </tr>
                ) : (
                  lineItems.map((item, index) => {
                    const lineSub = item.quantity * item.unitPrice;
                    const lineDisc = (lineSub * item.discountPercent) / 100;
                    const taxable = Math.max(0, lineSub - lineDisc);
                    const lineTotal = taxable * (1 + item.taxRate / 100);

                    return (
                      <tr key={item.productId} className="hover:bg-slate-50">
                        <td className="p-2.5 text-center font-bold font-mono text-slate-500">
                          {index + 1}
                        </td>
                        <td className="p-2.5 font-sans">
                          <span className="font-semibold text-slate-900 block">{item.productName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{item.sku}</span>
                        </td>
                        <td className="p-2.5 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              item.availableStock < item.quantity
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {item.availableStock}
                          </span>
                        </td>
                        <td className="p-2.5 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              handleUpdateItem(index, 'quantity', parseInt(e.target.value) || 1)
                            }
                            className="w-16 py-1 px-1.5 border border-slate-300 rounded text-center font-bold text-xs"
                          />
                        </td>
                        <td className="p-2.5 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitPrice}
                            onChange={(e) =>
                              handleUpdateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)
                            }
                            className="w-24 py-1 px-1.5 border border-slate-300 rounded text-right text-xs"
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={item.discountPercent || ''}
                            onChange={(e) =>
                              handleUpdateItem(index, 'discountPercent', parseFloat(e.target.value) || 0)
                            }
                            placeholder="0"
                            className="w-16 py-1 px-1.5 border border-slate-300 rounded text-center text-xs"
                          />
                        </td>
                        <td className="p-2.5 text-center text-slate-500">{item.taxRate}%</td>
                        <td className="p-2.5 text-right font-bold text-slate-900">
                          {formatCurrency(lineTotal, currencyCode, currencySymbol)}
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="text-slate-400 hover:text-rose-600 p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Totals & Payment Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* Left: Notes and Deposit Account */}
            <div className="space-y-3 text-xs">
              {saleTypeInput !== 'credit' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Payment Method
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                    >
                      <option value="cash">Cash Drawer</option>
                      <option value="bank_transfer">Bank Wire Transfer</option>
                      <option value="credit_card">Credit Card</option>
                      <option value="cheque">Cheque</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Deposit Account
                    </label>
                    <select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold"
                    >
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.accountName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {saleTypeInput === 'partial' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Initial Down Payment Received ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={totalAmount}
                    value={partialAmount}
                    onChange={(e) => setPartialAmount(e.target.value)}
                    placeholder="Enter amount paid today..."
                    className="w-full py-1.5 px-2.5 font-mono text-xs border border-slate-300 rounded-lg"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Notes & Commercial Terms
                </label>
                <textarea
                  value={invoiceNotes}
                  onChange={(e) => setInvoiceNotes(e.target.value)}
                  placeholder="Terms of service, warranty, delivery remarks..."
                  rows={2}
                  className="w-full p-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            {/* Right: Automated Calculation Box */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono">{formatCurrency(subtotal, currencyCode, currencySymbol)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Line Discounts:</span>
                <span className="font-mono text-emerald-600">
                  -{formatCurrency(lineDiscountsTotal, currencyCode, currencySymbol)}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>Overall Invoice Discount:</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={invoiceDiscountAmount || ''}
                  onChange={(e) => setInvoiceDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="0.00"
                  className="w-20 py-0.5 px-1.5 text-right font-mono border border-slate-300 rounded bg-white text-xs"
                />
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Sales Tax / VAT:</span>
                <span className="font-mono">{formatCurrency(taxAmount, currencyCode, currencySymbol)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-slate-900 border-t border-slate-200 pt-1.5">
                <span>GRAND TOTAL:</span>
                <span className="font-mono text-indigo-600">
                  {formatCurrency(totalAmount, currencyCode, currencySymbol)}
                </span>
              </div>
              <div className="flex justify-between font-semibold text-emerald-700">
                <span>Paid at Checkout:</span>
                <span className="font-mono">
                  {formatCurrency(paidAmountCalculated, currencyCode, currencySymbol)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-rose-600 border-t border-dashed border-slate-200 pt-1">
                <span>Remaining Customer Balance:</span>
                <span className="font-mono">
                  {formatCurrency(balanceAmountCalculated, currencyCode, currencySymbol)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons: Save Draft vs Post */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSaveInvoice(true)}
              disabled={isSubmitting}
              className="border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              <FileText className="w-3.5 h-3.5 mr-1" />
              {isSubmitting ? 'Saving...' : 'Save as Draft Quotation'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSaveInvoice(false)}
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              {isSubmitting ? 'Posting...' : 'Post Invoice & Deduct Inventory'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* EDIT DRAFT MODAL */}
      <Modal
        isOpen={editDraftModalOpen}
        onClose={() => setEditDraftModalOpen(false)}
        title={`Edit Draft Quotation: ${activeTargetSale?.invoiceNumber}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              This is a draft quotation. Quantities can be altered freely. Stock is only deducted when you post.
            </span>
          </div>

          {/* Customer & Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Customer</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search customer..."
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
              </div>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full mt-1 py-2 px-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
              >
                {filteredModalCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Date</label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date</label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>

          {/* Product Line Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2.5 w-10 text-center">#</th>
                  <th className="p-2.5">Product</th>
                  <th className="p-2.5 w-24 text-center">Qty</th>
                  <th className="p-2.5 w-28 text-right">Price</th>
                  <th className="p-2.5 w-20 text-center">Disc (%)</th>
                  <th className="p-2.5 w-24 text-right">Total</th>
                  <th className="p-2.5 w-12 text-center">Del</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {lineItems.map((item, index) => (
                  <tr key={index}>
                    <td className="p-2.5 text-center font-bold font-mono text-slate-500">
                      {index + 1}
                    </td>
                    <td className="p-2.5 font-sans font-semibold text-slate-900">{item.productName}</td>
                    <td className="p-2.5 text-center">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleUpdateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-16 py-1 px-1.5 border border-slate-300 rounded text-center text-xs"
                      />
                    </td>
                    <td className="p-2.5 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => handleUpdateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-24 py-1 px-1.5 border border-slate-300 rounded text-right text-xs"
                      />
                    </td>
                    <td className="p-2.5 text-center">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={item.discountPercent || ''}
                        onChange={(e) => handleUpdateItem(index, 'discountPercent', parseFloat(e.target.value) || 0)}
                        className="w-14 py-1 px-1 border border-slate-300 rounded text-center text-xs"
                      />
                    </td>
                    <td className="p-2.5 text-right font-bold">
                      {formatCurrency(
                        item.quantity * item.unitPrice * (1 - item.discountPercent / 100) * (1 + item.taxRate / 100),
                        currencyCode,
                        currencySymbol
                      )}
                    </td>
                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs font-mono">
            <span>Estimated Grand Total:</span>
            <span className="text-base font-bold text-indigo-600">
              {formatCurrency(totalAmount, currencyCode, currencySymbol)}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <Button variant="outline" size="sm" onClick={() => setEditDraftModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleUpdateDraft(false)}>
              Save Draft Changes
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleUpdateDraft(true)}
              className="bg-indigo-600 text-white font-bold"
            >
              Post Invoice & Finalize
            </Button>
          </div>
        </div>
      </Modal>

      {/* VOID / CANCEL SALE MODAL */}
      <Modal
        isOpen={voidModalOpen}
        onClose={() => setVoidModalOpen(false)}
        title={`Cancel / Void Sale: ${activeTargetSale?.invoiceNumber}`}
        size="md"
      >
        <div className="space-y-4">
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-2">
            <div className="flex items-center gap-2 font-bold text-rose-950 text-sm">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>Strict Financial Reversal Rule</span>
            </div>
            <p>
              Posted sales are legally protected and cannot be deleted. Voiding will permanently cancel this invoice and execute the following automated reversals:
            </p>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-rose-800">
              <li>Restore all {activeTargetSale?.items.reduce((s, it) => s + it.quantity, 0)} units of inventory back to warehouse stock.</li>
              <li>Reverse customer receivable balance (removes debit).</li>
              <li>If customer made payments, issues an offsetting refund disbursement voucher.</li>
            </ul>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Cancellation / Void Reason *
            </label>
            <textarea
              value={voidReasonInput}
              onChange={(e) => setVoidReasonInput(e.target.value)}
              placeholder="e.g. Order cancelled by client prior to dispatch, duplicate entry, billing error..."
              rows={3}
              className="w-full p-2.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <Button variant="outline" size="sm" onClick={() => setVoidModalOpen(false)}>
              Keep Sale Active
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmVoid}
              disabled={isSubmitting}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              {isSubmitting ? 'Reversing...' : 'Confirm Void & Reverse All Balances'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* SALE RETURN MODAL */}
      <Modal
        isOpen={returnModalOpen}
        onClose={() => setReturnModalOpen(false)}
        title={`Customer Return: ${activeTargetSale?.invoiceNumber}`}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Select items to return to warehouse inventory. Returned units will be restocked immediately.
          </p>

          {/* Line items return table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-2">Item</th>
                  <th className="p-2 text-center">Sold Qty</th>
                  <th className="p-2 text-center">Already Ret.</th>
                  <th className="p-2 text-center w-24">Return Now</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {activeTargetSale?.items.map((it) => {
                  const alreadyRet = it.returnedQuantity || 0;
                  const maxReturnable = Math.max(0, it.quantity - alreadyRet);

                  return (
                    <tr key={it.productId}>
                      <td className="p-2 font-sans font-semibold text-slate-800">{it.productName}</td>
                      <td className="p-2 text-center">{it.quantity}</td>
                      <td className="p-2 text-center text-slate-400">{alreadyRet}</td>
                      <td className="p-2 text-center">
                        <input
                          type="number"
                          min="0"
                          max={maxReturnable}
                          value={returnQuantities[it.productId] ?? ''}
                          onChange={(e) => {
                            const val = Math.min(maxReturnable, Math.max(0, parseInt(e.target.value) || 0));
                            setReturnQuantities((prev) => ({ ...prev, [it.productId]: val }));
                          }}
                          disabled={maxReturnable <= 0}
                          placeholder="0"
                          className="w-16 py-1 px-1.5 border border-slate-300 rounded text-center text-xs"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Refund Method
              </label>
              <select
                value={returnRefundMethod}
                onChange={(e) => setReturnRefundMethod(e.target.value as any)}
                className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-xs"
              >
                <option value="credit_account">Credit Customer Account (Reduces Debt)</option>
                <option value="cash_refund">Cash / Bank Payout</option>
              </select>
            </div>

            {returnRefundMethod === 'cash_refund' && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Disburse From Account
                </label>
                <select
                  value={returnAccountId}
                  onChange={(e) => setReturnAccountId(e.target.value)}
                  className="w-full py-1.5 px-2 bg-white border border-slate-300 rounded-lg text-xs"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.accountName}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Return Reason
            </label>
            <input
              type="text"
              value={returnReasonInput}
              onChange={(e) => setReturnReasonInput(e.target.value)}
              placeholder="e.g. Damaged goods, customer downsizing, exchange..."
              className="w-full py-1.5 px-2.5 text-xs border border-slate-300 rounded-lg"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <Button variant="outline" size="sm" onClick={() => setReturnModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmReturn}
              disabled={isSubmitting}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold"
            >
              {isSubmitting ? 'Processing...' : 'Restock Items & Complete Return'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* QUICK COLLECT PAYMENT ON INVOICE MODAL */}
      <Modal
        isOpen={collectPaymentModalOpen}
        onClose={() => {
          setCollectPaymentModalOpen(false);
          setInvoiceToCollect(null);
        }}
        title={`Collect Payment - ${invoiceToCollect?.invoiceNumber || ''}`}
        size="md"
      >
        {invoiceToCollect && (
          <div className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs flex justify-between items-center">
              <div>
                <span className="text-slate-500 block">Customer:</span>
                <span className="font-bold text-slate-800 text-sm">{invoiceToCollect.customerName}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block">Balance Due:</span>
                <span className="font-bold font-mono text-rose-600 text-base">
                  {formatCurrency(invoiceToCollect.balanceAmount, currencyCode, currencySymbol)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Receipt Amount ({currencySymbol}) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={invoiceToCollect.balanceAmount}
                value={collectAmount}
                onChange={(e) => setCollectAmount(e.target.value)}
                className="w-full text-sm font-mono font-bold px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="0.00"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Total Invoice: {formatCurrency(invoiceToCollect.totalAmount, currencyCode, currencySymbol)} | Already Paid: {formatCurrency(invoiceToCollect.paidAmount, currencyCode, currencySymbol)}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Deposit Destination Account *
              </label>
              <select
                value={collectAccountId}
                onChange={(e) => setCollectAccountId(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                {accounts
                  .filter((a) => a.status === 'active' && !a.isDeleted)
                  .map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.accountName} ({acc.type?.toUpperCase() || 'CASH'}) - Bal: {formatCurrency(acc.currentBalance || 0, currencyCode, currencySymbol)}
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={collectMethod}
                  onChange={(e) => setCollectMethod(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="cash">Cash in Till</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="credit_card">Credit / Debit Card</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Reference</label>
                <input
                  type="text"
                  value={collectReference}
                  onChange={(e) => setCollectReference(e.target.value)}
                  placeholder="e.g. TRX-9821 or Cash"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCollectPaymentModalOpen(false);
                  setInvoiceToCollect(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmCollectPayment}
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                {isSubmitting ? 'Recording Receipt...' : 'Confirm Receipt & Sync'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* VIEW SALE MODAL */}
      {viewInvoice && (
        <Modal
          isOpen={true}
          onClose={() => setViewInvoice(null)}
          title={`Invoice ${viewInvoice.invoiceNumber}`}
          size="lg"
        >
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-200 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight font-mono">
                    {viewInvoice.invoiceNumber}
                  </h3>
                  {renderStatusBadge(viewInvoice)}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Issued on {formatDate(viewInvoice.date)} • Due by{' '}
                  {formatDate(viewInvoice.dueDate || viewInvoice.date)}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {viewInvoice.balanceAmount > 0 && viewInvoice.saleStatus !== 'void' && viewInvoice.saleStatus !== 'draft' && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => handleOpenCollectPaymentModal(viewInvoice)}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-1"
                  >
                    <DollarSign className="w-3.5 h-3.5" /> Collect ({formatCurrency(viewInvoice.balanceAmount, currencyCode, currencySymbol)})
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => printCommercialInvoice(viewInvoice, currentTenant)}
                  className="flex items-center gap-1.5 text-xs py-1"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" /> Print
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const cust = customers.find((c) => c.id === viewInvoice.customerId);
                    window.open(
                      generateWhatsAppInvoiceLink(viewInvoice, cust?.phone, currentTenant?.name),
                      '_blank'
                    );
                  }}
                  className="flex items-center gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50 text-xs py-1"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const cust = customers.find((c) => c.id === viewInvoice.customerId);
                    window.location.href = generateEmailInvoiceLink(
                      viewInvoice,
                      cust?.email,
                      currentTenant?.name
                    );
                  }}
                  className="flex items-center gap-1.5 text-blue-700 border-blue-300 hover:bg-blue-50 text-xs py-1"
                >
                  <Mail className="w-3.5 h-3.5 text-blue-600" /> Email
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => printCommercialInvoice(viewInvoice, currentTenant)}
                  className="flex items-center gap-1.5 bg-indigo-600 text-white hover:bg-indigo-700 text-xs py-1"
                >
                  <Download className="w-3.5 h-3.5" /> PDF
                </Button>
              </div>
            </div>

            {/* Bill To & Status Card */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-col sm:flex-row justify-between gap-3 text-xs">
              <div>
                <span className="text-slate-500 block text-[11px]">Billed Customer:</span>
                <span className="font-bold text-slate-900 text-sm">{viewInvoice.customerName}</span>
                <span className="text-slate-400 block font-mono text-[10px]">ID: {viewInvoice.customerId}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block text-[11px]">Payment Status:</span>
                <div>{renderPaymentBadge(viewInvoice)}</div>
              </div>
            </div>

            {/* Line items */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200 font-semibold">
                  <tr>
                    <th className="p-2.5 w-10 text-center">#</th>
                    <th className="p-2.5">Item Description</th>
                    <th className="p-2.5 text-center">Qty</th>
                    <th className="p-2.5 text-right">Price</th>
                    <th className="p-2.5 text-center">Disc</th>
                    <th className="p-2.5 text-center">Tax</th>
                    <th className="p-2.5 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {viewInvoice.items?.map((item, i) => (
                    <tr key={i}>
                      <td className="p-2.5 text-center font-bold font-mono text-slate-500">
                        {i + 1}
                      </td>
                      <td className="p-2.5 font-sans">
                        <div className="font-medium text-slate-900">{item.productName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{item.sku}</div>
                        {item.returnedQuantity && item.returnedQuantity > 0 ? (
                          <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 text-[10px] font-bold">
                            {item.returnedQuantity} unit(s) returned
                          </span>
                        ) : null}
                      </td>
                      <td className="p-2.5 text-center">{item.quantity}</td>
                      <td className="p-2.5 text-right font-mono">
                        {formatCurrency(item.unitPrice, currencyCode, currencySymbol)}
                      </td>
                      <td className="p-2.5 text-center">
                        {item.discountPercent ? `${item.discountPercent}%` : '—'}
                      </td>
                      <td className="p-2.5 text-center">{item.taxRate}%</td>
                      <td className="p-2.5 text-right font-mono font-bold">
                        {formatCurrency(item.total, currencyCode, currencySymbol)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary Box */}
            <div className="bg-slate-50 p-4 rounded-lg space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-slate-600 font-sans">
                <span>Subtotal:</span>
                <span className="font-mono">{formatCurrency(viewInvoice.subtotal, currencyCode, currencySymbol)}</span>
              </div>
              {viewInvoice.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-sans">
                  <span>Total Discount:</span>
                  <span className="font-mono">-{formatCurrency(viewInvoice.discountAmount, currencyCode, currencySymbol)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600 font-sans">
                <span>Tax Amount:</span>
                <span className="font-mono">{formatCurrency(viewInvoice.taxAmount, currencyCode, currencySymbol)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-slate-900 border-t border-slate-200 pt-1.5 font-sans">
                <span>Grand Total:</span>
                <span className="font-mono text-indigo-600">{formatCurrency(viewInvoice.totalAmount, currencyCode, currencySymbol)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-semibold font-sans">
                <span>Paid to Date:</span>
                <span className="font-mono">{formatCurrency(viewInvoice.paidAmount, currencyCode, currencySymbol)}</span>
              </div>
              <div className="flex justify-between text-rose-600 font-bold border-t border-dashed border-slate-200 pt-1.5 font-sans">
                <span>Outstanding Balance:</span>
                <span className="font-mono">{formatCurrency(viewInvoice.balanceAmount, currencyCode, currencySymbol)}</span>
              </div>
            </div>

            {/* Void / Return Audit Remarks */}
            {viewInvoice.voidReason && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900">
                <span className="font-bold block">Void / Cancellation Reason:</span>
                <span>{viewInvoice.voidReason}</span>
              </div>
            )}

            {viewInvoice.notes && (
              <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <span className="font-bold text-slate-700">Notes: </span>
                {viewInvoice.notes}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

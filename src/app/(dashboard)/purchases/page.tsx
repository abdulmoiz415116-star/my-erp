'use client';

import React, { useState, useMemo } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  PurchaseService,
  SupplierService,
  ProductService,
  StockTransactionService,
  PaymentService,
  AccountService,
  AuditLogService,
} from '@/services/erp.service';
import { PurchaseOrder, PurchaseOrderItem, Supplier, Product, Account, PurchaseStatus } from '@/types/erp';
import { useRealtimeCollection } from '@/hooks/useRealtimeCollection';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable, Column } from '@/components/common/DataTable';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { formatCurrency, formatDate } from '@/lib/utils';
import { printCommercialPurchaseOrder } from '@/lib/pdfPrint';
import { generateNextPONumber } from '@/lib/sequenceGenerator';
import {
  Plus,
  Truck,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  Trash2,
  Printer,
  FileText,
  Building2,
  Package,
  RotateCcw,
  Ban,
  Edit3,
  Search,
  Filter,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';

interface PurchaseDraftItem {
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitCost: number;
  taxRate: number;
  discountPercent: number;
  currentStock: number;
  returnedQuantity?: number;
}

export default function PurchasesPage() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { showToast } = useToast();

  const tenantId = currentTenant?.id || 'tenant-apex-corp';
  const currencySymbol = currentTenant?.settings.currencySymbol || '$';
  const currencyCode = currentTenant?.settings.currency || 'USD';

  // Real-time purchases collection
  const {
    items: purchases,
    allItems: allPurchases,
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
  } = useRealtimeCollection<PurchaseOrder>((tId) => new PurchaseService(tId), {
    sortBy: 'date',
    sortDirection: 'desc',
  });

  // Supporting real-time collections
  const { allItems: suppliers } = useRealtimeCollection<Supplier>((tId) => new SupplierService(tId));
  const { allItems: products } = useRealtimeCollection<Product>((tId) => new ProductService(tId));
  const { allItems: accounts } = useRealtimeCollection<Account>((tId) => new AccountService(tId));

  // Services for multi-record transactional updates
  const stockTxService = useMemo(() => new StockTransactionService(tenantId), [tenantId]);
  const productService = useMemo(() => new ProductService(tenantId), [tenantId]);
  const paymentService = useMemo(() => new PaymentService(tenantId), [tenantId]);
  const accountService = useMemo(() => new AccountService(tenantId), [tenantId]);
  const supplierService = useMemo(() => new SupplierService(tenantId), [tenantId]);
  const auditLogService = useMemo(() => new AuditLogService(tenantId), [tenantId]);

  // Lifecycle Tabs: all, received, draft, pending, returned, void
  const [lifecycleTab, setLifecycleTab] = useState<'all' | 'received' | 'draft' | 'pending' | 'returned' | 'void'>('all');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'all' | 'paid' | 'partial' | 'unpaid'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [viewPO, setViewPO] = useState<PurchaseOrder | null>(null);
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [poToVoid, setPoToVoid] = useState<PurchaseOrder | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [poToReturn, setPoToReturn] = useState<PurchaseOrder | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [returnRefundMode, setReturnRefundMode] = useState<'credit_account' | 'cash_refund'>('credit_account');
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  // Quick Disburse Payment Modal State
  const [disburseModalOpen, setDisburseModalOpen] = useState(false);
  const [poToDisburse, setPoToDisburse] = useState<PurchaseOrder | null>(null);
  const [disburseAmount, setDisburseAmount] = useState('');
  const [disburseAccountId, setDisburseAccountId] = useState('');
  const [disburseMethod, setDisburseMethod] = useState<'cash' | 'bank_transfer' | 'credit_card' | 'cheque'>('bank_transfer');
  const [disburseRef, setDisburseRef] = useState('');

  // Form State for New / Edit PO
  const [poNumberInput, setPoNumberInput] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
  const [receiptStatus, setReceiptStatus] = useState<'received' | 'pending'>('received');
  const [poNotes, setPoNotes] = useState('');
  const [lineItems, setLineItems] = useState<PurchaseDraftItem[]>([]);
  const [purchaseType, setPurchaseType] = useState<'credit' | 'cash' | 'bank' | 'partial'>('credit');
  const [globalDiscount, setGlobalDiscount] = useState('0');
  const [partialAmount, setPartialAmount] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bank_transfer' | 'credit_card' | 'cheque'>('bank_transfer');
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');

  const filteredSuppliers = useMemo(() => {
    const q = supplierSearchQuery.trim().toLowerCase();
    const activeSupps = suppliers.filter((s) => !s.isDeleted && s.status === 'active');
    if (!q) return activeSupps;
    return activeSupps.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q) ||
        s.companyName?.toLowerCase().includes(q)
    );
  }, [suppliers, supplierSearchQuery]);

  // Reset Create Form
  const resetForm = () => {
    setEditingPO(null);
    const nextNum = generateNextPONumber(
      allPurchases.map((p) => p.poNumber),
      currentTenant?.settings?.purchaseOrderPrefix || 'PO-',
      currentTenant?.settings?.purchaseOrderNextNumber || 1001
    );
    setPoNumberInput(nextNum);
    setSelectedSupplierId('');
    setSupplierSearchQuery('');
    setPoDate(new Date().toISOString().split('T')[0]);
    setDueDate(new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]);
    setReceiptStatus('received');
    setPoNotes('');
    setLineItems([]);
    setPurchaseType('credit');
    setGlobalDiscount('0');
    setPartialAmount('');
    setSelectedAccountId(accounts[0]?.id || '');
    setPaymentMethod('bank_transfer');
  };

  const handleOpenCreateModal = () => {
    resetForm();
    if (accounts.length > 0) {
      setSelectedAccountId(accounts[0].id);
    }
    if (products.length > 0) {
      const firstProd = products[0];
      setLineItems([
        {
          productId: firstProd.id,
          productName: firstProd.name,
          sku: firstProd.sku,
          quantity: 10,
          unitCost: firstProd.costPrice,
          taxRate: firstProd.taxRate || 0,
          discountPercent: 0,
          currentStock: firstProd.currentStock,
        },
      ]);
    }
    setCreateModalOpen(true);
  };

  const handleOpenEditDraftModal = (po: PurchaseOrder) => {
    setEditingPO(po);
    setPoNumberInput(po.poNumber);
    setSelectedSupplierId(po.supplierId);
    setPoDate(po.date);
    setDueDate(po.dueDate || new Date().toISOString().split('T')[0]);
    setReceiptStatus(po.receiptStatus === 'received' ? 'received' : 'pending');
    setPoNotes(po.notes || '');
    setGlobalDiscount(po.discountAmount ? String(po.discountAmount) : '0');

    if (po.purchaseType) {
      setPurchaseType(po.purchaseType);
    } else if (po.paidAmount >= po.totalAmount && po.totalAmount > 0) {
      setPurchaseType(po.paymentMethod === 'cash' ? 'cash' : 'bank');
    } else if (po.paidAmount > 0) {
      setPurchaseType('partial');
    } else {
      setPurchaseType('credit');
    }

    setPartialAmount(po.paidAmount > 0 ? String(po.paidAmount) : '');
    setSelectedAccountId(po.accountId || accounts[0]?.id || '');
    setPaymentMethod(po.paymentMethod || 'bank_transfer');
    setLineItems(
      po.items.map((it) => {
        const prod = products.find((p) => p.id === it.productId);
        return {
          productId: it.productId,
          productName: it.productName,
          sku: it.sku,
          quantity: it.quantity,
          unitCost: it.unitCost,
          taxRate: it.taxRate || 0,
          discountPercent: it.discountPercent || 0,
          currentStock: prod?.currentStock ?? 0,
          returnedQuantity: it.returnedQuantity || 0,
        };
      })
    );
    setCreateModalOpen(true);
  };

  const handleAddLineItem = () => {
    if (products.length === 0) return;
    const firstProd = products[0];
    setLineItems([
      ...lineItems,
      {
        productId: firstProd.id,
        productName: firstProd.name,
        sku: firstProd.sku,
        quantity: 5,
        unitCost: firstProd.costPrice,
        taxRate: firstProd.taxRate || 0,
        discountPercent: 0,
        currentStock: firstProd.currentStock,
      },
    ]);
  };

  const handleUpdateLineItem = (index: number, updates: Partial<PurchaseDraftItem>) => {
    const updated = [...lineItems];
    if (updates.productId) {
      const prod = products.find((p) => p.id === updates.productId);
      if (prod) {
        updated[index] = {
          ...updated[index],
          productId: prod.id,
          productName: prod.name,
          sku: prod.sku,
          unitCost: prod.costPrice,
          taxRate: prod.taxRate || 0,
          currentStock: prod.currentStock,
        };
      }
    } else {
      updated[index] = { ...updated[index], ...updates };
    }
    setLineItems(updated);
  };

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length === 1) {
      showToast('At least one item is required in the purchase order.', 'error');
      return;
    }
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  // Calculations
  const lineSubtotal = useMemo(() => {
    return lineItems.reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
  }, [lineItems]);

  const lineDiscountTotal = useMemo(() => {
    return lineItems.reduce((sum, item) => {
      const gross = item.quantity * item.unitCost;
      const disc = gross * ((item.discountPercent || 0) / 100);
      return sum + disc;
    }, 0);
  }, [lineItems]);

  const globalDiscountNum = useMemo(() => {
    return Math.max(0, parseFloat(globalDiscount) || 0);
  }, [globalDiscount]);

  const totalDiscount = useMemo(() => {
    return Math.min(lineSubtotal, lineDiscountTotal + globalDiscountNum);
  }, [lineSubtotal, lineDiscountTotal, globalDiscountNum]);

  const taxAmount = useMemo(() => {
    return lineItems.reduce((sum, item) => {
      const gross = item.quantity * item.unitCost;
      const itemDisc = gross * ((item.discountPercent || 0) / 100);
      const itemNet = Math.max(0, gross - itemDisc);
      return sum + (itemNet * (item.taxRate || 0)) / 100;
    }, 0);
  }, [lineItems]);

  const totalAmount = useMemo(() => {
    const netBeforeTax = Math.max(0, lineSubtotal - totalDiscount);
    return netBeforeTax + taxAmount;
  }, [lineSubtotal, totalDiscount, taxAmount]);

  const paidAmountCalculated = useMemo(() => {
    if (purchaseType === 'credit') return 0;
    if (purchaseType === 'cash' || purchaseType === 'bank') return totalAmount;
    const p = parseFloat(partialAmount) || 0;
    return Math.min(Math.max(0, p), totalAmount);
  }, [purchaseType, partialAmount, totalAmount]);

  const balanceAmountCalculated = useMemo(() => {
    return Math.max(0, totalAmount - paidAmountCalculated);
  }, [totalAmount, paidAmountCalculated]);

  // Submit Purchase Order (Either as Draft or Confirmed Received/Pending)
  const handleSubmitPO = async (asDraft: boolean) => {
    const trimmedPoNum = (
      poNumberInput.trim() ||
      generateNextPONumber(
        allPurchases.map((p) => p.poNumber),
        currentTenant?.settings?.purchaseOrderPrefix || 'PO-',
        currentTenant?.settings?.purchaseOrderNextNumber || 1001
      )
    ).toUpperCase();
    if (!trimmedPoNum) {
      showToast('Purchase Order Number is required.', 'error');
      return;
    }

    // Duplicate check
    const isDuplicate = allPurchases.some(
      (p) => p.poNumber.trim().toUpperCase() === trimmedPoNum && p.id !== editingPO?.id
    );
    if (isDuplicate) {
      showToast(`Purchase Order Number "${trimmedPoNum}" already exists. Please choose a unique number.`, 'error');
      return;
    }

    if (!selectedSupplierId) {
      showToast('Please select a supplier.', 'error');
      return;
    }
    const supplier = suppliers.find((s) => s.id === selectedSupplierId);
    if (!supplier) {
      showToast('Selected supplier is invalid.', 'error');
      return;
    }

    if (lineItems.length === 0) {
      showToast('Please add at least one product item.', 'error');
      return;
    }

    for (const item of lineItems) {
      if (item.quantity <= 0) {
        showToast(`Quantity for ${item.productName} must be greater than 0.`, 'error');
        return;
      }
      if (item.unitCost < 0) {
        showToast(`Unit cost for ${item.productName} cannot be negative.`, 'error');
        return;
      }
      if (item.discountPercent < 0 || item.discountPercent > 100) {
        showToast(`Discount for ${item.productName} must be between 0% and 100%.`, 'error');
        return;
      }
    }

    setSubmitting(true);
    try {
      const finalItems: PurchaseOrderItem[] = lineItems.map((item) => {
        const gross = item.quantity * item.unitCost;
        const lineDisc = gross * ((item.discountPercent || 0) / 100);
        const net = Math.max(0, gross - lineDisc);
        const itemTax = (net * (item.taxRate || 0)) / 100;
        return {
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          quantity: item.quantity,
          unitCost: item.unitCost,
          taxRate: item.taxRate,
          discountPercent: item.discountPercent || 0,
          discountAmount: lineDisc,
          subtotal: net,
          total: net + itemTax,
          returnedQuantity: item.returnedQuantity || 0,
        };
      });

      const effectivePurchaseStatus: PurchaseStatus = asDraft
        ? 'draft'
        : receiptStatus === 'received'
        ? 'received'
        : 'received';

      const finalPaid = asDraft ? 0 : paidAmountCalculated;
      const finalBalance = asDraft ? totalAmount : balanceAmountCalculated;
      const paymentStatus =
        finalPaid >= totalAmount && totalAmount > 0 ? 'paid' : finalPaid > 0 ? 'partial' : 'unpaid';

      const effectivePaymentMethod =
        purchaseType === 'cash'
          ? 'cash'
          : purchaseType === 'bank'
          ? 'bank_transfer'
          : purchaseType === 'partial'
          ? paymentMethod
          : undefined;

      const chosenAcc = accounts.find((a) => a.id === selectedAccountId);

      const poPayload: Partial<PurchaseOrder> = {
        poNumber: trimmedPoNum,
        supplierId: supplier.id,
        supplierName: supplier.name,
        date: poDate,
        dueDate,
        items: finalItems,
        subtotal: lineSubtotal,
        discountAmount: totalDiscount,
        taxAmount,
        totalAmount,
        paidAmount: finalPaid,
        balanceAmount: finalBalance,
        paymentStatus,
        receiptStatus: asDraft ? 'pending' : receiptStatus,
        purchaseStatus: effectivePurchaseStatus,
        purchaseType,
        paymentMethod: asDraft ? undefined : effectivePaymentMethod,
        accountId: asDraft || finalPaid === 0 ? undefined : selectedAccountId,
        accountName: asDraft || finalPaid === 0 ? undefined : chosenAcc?.accountName,
        notes: poNotes || `Procurement from ${supplier.name}`,
        status: 'active',
      };

      let savedPOId = editingPO?.id;

      if (editingPO) {
        await updateItem(editingPO.id, poPayload);
      } else {
        const created = await createItem(poPayload as any);
        savedPOId = created.id;
      }

      // If confirming/posting (not saving as draft):
      if (!asDraft) {
        // 1. Stock inward if received
        if (receiptStatus === 'received') {
          for (const item of lineItems) {
            await stockTxService.create({
              productId: item.productId,
              productName: item.productName,
              sku: item.sku,
              quantity: item.quantity,
              direction: 'in',
              type: 'purchase',
              reference: trimmedPoNum,
              referenceType: 'purchase',
              date: poDate,
              cost: item.unitCost,
              totalCost: item.unitCost * item.quantity,
              userId: user?.uid || 'user-admin',
              userName: user?.displayName || 'Administrator',
              notes: `Goods received via PO #${trimmedPoNum}`,
            });

            const currentProd = products.find((p) => p.id === item.productId);
            if (currentProd) {
              await productService.update(item.productId, {
                currentStock: currentProd.currentStock + item.quantity,
              });
            }
          }
        }

        // 2. Payment disbursement if paid > 0
        if (finalPaid > 0 && selectedAccountId) {
          const paymentNumber = `PAY-${Date.now().toString().slice(-5)}`;
          await paymentService.create({
            paymentNumber,
            partyType: 'supplier',
            partyId: supplier.id,
            partyName: supplier.name,
            type: 'payment',
            amount: finalPaid,
            date: poDate,
            accountId: selectedAccountId,
            accountName: chosenAcc?.accountName || 'Bank Account',
            paymentMethod: effectivePaymentMethod || 'bank_transfer',
            reference: trimmedPoNum,
            purchaseOrderId: savedPOId,
            purchaseOrderNumber: trimmedPoNum,
            notes: `Disbursement for Purchase Order ${trimmedPoNum}`,
            status: 'active',
          });

          if (chosenAcc) {
            await accountService.update(selectedAccountId, {
              currentBalance: (chosenAcc.currentBalance || 0) - finalPaid,
            });
          }
        }

        // Real-time update to Supplier Payable balance if credit/unpaid balance exists
        if (finalBalance > 0 && supplier) {
          await supplierService.update(supplier.id, {
            currentBalance: (supplier.currentBalance || 0) + finalBalance,
          });
        }
      }

      // Audit Log
      await auditLogService.create({
        action: editingPO ? 'UPDATE' : 'CREATE',
        module: 'Purchases',
        entityId: trimmedPoNum,
        entityName: supplier.name,
        description: asDraft
          ? `${editingPO ? 'Updated' : 'Created'} Draft Purchase Order #${trimmedPoNum} for ${supplier.name}`
          : `${editingPO ? 'Posted Draft' : 'Created'} Official Purchase Order #${trimmedPoNum} for ${supplier.name} ($${totalAmount.toFixed(2)})`,
        userId: user?.uid || 'system',
        userName: user?.displayName || 'Administrator',
        userEmail: user?.email || 'admin@erp.com',
        timestamp: new Date().toISOString(),
      });

      showToast(
        asDraft
          ? `Draft PO ${trimmedPoNum} saved! Inventory and accounts remain unchanged.`
          : `Purchase Order ${trimmedPoNum} posted! Stock and financial ledgers updated in real-time.`,
        'success'
      );
      setCreateModalOpen(false);
      resetForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save purchase order';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Receive Shipment for Pending PO
  const handleReceiveShipment = async (po: PurchaseOrder) => {
    if (po.receiptStatus === 'received') {
      showToast('This order has already been received.', 'info');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Log stock transactions & increment inventory
      for (const item of po.items) {
        await stockTxService.create({
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          quantity: item.quantity,
          direction: 'in',
          type: 'purchase',
          reference: po.poNumber,
          referenceType: 'purchase',
          date: new Date().toISOString().split('T')[0],
          cost: item.unitCost,
          totalCost: item.unitCost * item.quantity,
          userId: user?.uid || 'user-admin',
          userName: user?.displayName || 'Administrator',
          notes: `Shipment received for PO #${po.poNumber}`,
        });

        const prod = products.find((p) => p.id === item.productId);
        if (prod) {
          await productService.update(item.productId, {
            currentStock: prod.currentStock + item.quantity,
          });
        }
      }

      // 2. Update PO status
      await updateItem(po.id, {
        receiptStatus: 'received',
        purchaseStatus: 'received',
      });

      // Audit Log
      await auditLogService.create({
        action: 'UPDATE',
        module: 'Purchases',
        entityId: po.poNumber,
        entityName: po.supplierName,
        description: `Marked PO #${po.poNumber} as Received; warehouse stock updated in real-time`,
        userId: user?.uid || 'system',
        userName: user?.displayName || 'Administrator',
        userEmail: user?.email || 'admin@erp.com',
        timestamp: new Date().toISOString(),
      });

      showToast(`Shipment for PO ${po.poNumber} received and added to inventory!`, 'success');
      if (viewPO?.id === po.id) {
        setViewPO({ ...po, receiptStatus: 'received', purchaseStatus: 'received' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to receive shipment';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Void / Cancel Purchase Order
  const handleVoidPO = async () => {
    if (!poToVoid) return;
    if (!voidReason.trim()) {
      showToast('Please provide a reason for cancelling this purchase order.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const nowStr = new Date().toISOString();

      // 1. If Goods Were Received: Reverse stock by creating counter adjustment transactions & decrementing stock
      if (poToVoid.receiptStatus === 'received') {
        for (const item of poToVoid.items) {
          await stockTxService.create({
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            quantity: item.quantity,
            direction: 'out',
            type: 'adjustment_out',
            reference: `VOID-${poToVoid.poNumber}`,
            referenceType: 'stock_adjustment',
            date: nowStr.split('T')[0],
            cost: item.unitCost,
            totalCost: item.unitCost * item.quantity,
            userId: user?.uid || 'user-admin',
            userName: user?.displayName || 'Administrator',
            notes: `Counter adjustment: Cancelled PO #${poToVoid.poNumber}. Reason: ${voidReason}`,
          });

          const prod = products.find((p) => p.id === item.productId);
          if (prod) {
            await productService.update(item.productId, {
              currentStock: Math.max(0, prod.currentStock - item.quantity),
            });
          }
        }
      }

      // 2. If Payment was disbursed: issue refund disbursement into Account
      if (poToVoid.paidAmount > 0 && poToVoid.accountId) {
        const acc = accounts.find((a) => a.id === poToVoid.accountId);
        if (acc) {
          await accountService.update(poToVoid.accountId, {
            currentBalance: (acc.currentBalance || 0) + poToVoid.paidAmount,
          });

          await paymentService.create({
            paymentNumber: `REFUND-PO-${Date.now().toString().slice(-5)}`,
            partyType: 'supplier',
            partyId: poToVoid.supplierId,
            partyName: poToVoid.supplierName,
            type: 'receipt',
            amount: poToVoid.paidAmount,
            date: nowStr.split('T')[0],
            accountId: poToVoid.accountId,
            accountName: acc.accountName,
            paymentMethod: poToVoid.paymentMethod || 'bank_transfer',
            reference: `VOID-${poToVoid.poNumber}`,
            purchaseOrderId: poToVoid.id,
            purchaseOrderNumber: poToVoid.poNumber,
            notes: `Refund from supplier for cancelled PO #${poToVoid.poNumber}`,
            status: 'active',
          });
        }
      }

      // 3. If PO had an unpaid credit balance, reverse supplier payable balance
      if (poToVoid.balanceAmount > 0) {
        const supp = suppliers.find((s) => s.id === poToVoid.supplierId);
        if (supp) {
          await supplierService.update(supp.id, {
            currentBalance: Math.max(0, (supp.currentBalance || 0) - poToVoid.balanceAmount),
          });
        }
      }

      // 4. Mark PO as void
      await updateItem(poToVoid.id, {
        purchaseStatus: 'void',
        voidReason,
        voidDate: nowStr,
      });

      // Audit Log
      await auditLogService.create({
        action: 'STATUS_CHANGE',
        module: 'Purchases',
        entityId: poToVoid.poNumber,
        entityName: poToVoid.supplierName,
        description: `Cancelled / Voided PO #${poToVoid.poNumber}. Reason: ${voidReason}`,
        userId: user?.uid || 'system',
        userName: user?.displayName || 'Administrator',
        userEmail: user?.email || 'admin@erp.com',
        timestamp: nowStr,
      });

      showToast(`Purchase Order ${poToVoid.poNumber} cancelled. Stock and supplier ledger reversed!`, 'success');
      setVoidModalOpen(false);
      setPoToVoid(null);
      setVoidReason('');
      if (viewPO?.id === poToVoid.id) {
        setViewPO(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to void purchase order';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Quick Disburse Payment Modal
  const handleOpenDisbursePaymentModal = (po: PurchaseOrder) => {
    if (po.purchaseStatus === 'void' || po.purchaseStatus === 'draft') {
      showToast('Cannot make payments on draft or voided purchase orders.', 'info');
      return;
    }
    if (po.balanceAmount <= 0) {
      showToast('This purchase order is already paid in full.', 'info');
      return;
    }
    setPoToDisburse(po);
    setDisburseAmount(po.balanceAmount.toString());
    const activeAccs = accounts.filter((a) => a.status === 'active' && !a.isDeleted);
    setDisburseAccountId(activeAccs[0]?.id || '');
    setDisburseMethod('bank_transfer');
    setDisburseRef(`PMT-${po.poNumber}`);
    setDisburseModalOpen(true);
  };

  // Confirm Quick Disburse Payment
  const handleConfirmDisbursePayment = async () => {
    if (!poToDisburse || submitting) return;
    const parsed = parseFloat(disburseAmount);
    if (!parsed || parsed <= 0) {
      showToast('Please enter a valid disbursement amount greater than 0.', 'error');
      return;
    }
    if (parsed > poToDisburse.balanceAmount) {
      showToast(
        `Amount cannot exceed outstanding balance of ${formatCurrency(poToDisburse.balanceAmount, currencyCode, currencySymbol)}.`,
        'error'
      );
      return;
    }

    setSubmitting(true);
    try {
      const nowStr = new Date().toISOString();
      const targetAcc = accounts.find((a) => a.id === disburseAccountId) || accounts[0];
      const pmtNum = `PMT-${Date.now().toString().slice(-5)}`;

      // 1. Auto-generate Payment record in Payment Ledger
      await paymentService.create({
        paymentNumber: pmtNum,
        partyType: 'supplier',
        partyId: poToDisburse.supplierId,
        partyName: poToDisburse.supplierName,
        type: 'payment',
        amount: parsed,
        date: nowStr.split('T')[0],
        accountId: targetAcc ? targetAcc.id : 'acc-001',
        accountName: targetAcc ? targetAcc.accountName : 'Bank / Operating Account',
        paymentMethod: disburseMethod,
        reference: disburseRef || poToDisburse.poNumber,
        purchaseOrderId: poToDisburse.id,
        purchaseOrderNumber: poToDisburse.poNumber,
        notes: `Disbursement for Purchase Order #${poToDisburse.poNumber}`,
        status: 'active',
      });

      // 2. Deduct from Account Balance
      if (targetAcc) {
        await accountService.update(targetAcc.id, {
          currentBalance: (targetAcc.currentBalance || 0) - parsed,
        });
      }

      // 3. Update Purchase Order
      const newPaid = (poToDisburse.paidAmount || 0) + parsed;
      const newBalance = Math.max(0, poToDisburse.totalAmount - newPaid);
      const newStatus = newBalance <= 0.01 ? 'paid' : 'partial';

      await updateItem(poToDisburse.id, {
        paidAmount: newPaid,
        balanceAmount: newBalance,
        paymentStatus: newStatus,
      });

      // 4. Update Supplier Payable Balance
      const supp = suppliers.find((s) => s.id === poToDisburse.supplierId);
      if (supp) {
        await supplierService.update(supp.id, {
          currentBalance: Math.max(0, (supp.currentBalance || 0) - parsed),
        });
      }

      // 5. Immutable Audit Log
      await auditLogService.create({
        action: 'PAYMENT',
        module: 'Purchases',
        entityId: poToDisburse.poNumber,
        entityName: poToDisburse.supplierName,
        description: `Disbursed ${formatCurrency(parsed, currencyCode, currencySymbol)} on PO #${poToDisburse.poNumber} from ${targetAcc?.accountName}`,
        userId: user?.uid || 'system',
        userName: user?.displayName || 'Procurement Officer',
        userEmail: user?.email || 'admin@erp.com',
        timestamp: nowStr,
      });

      showToast(`Payment of ${formatCurrency(parsed, currencyCode, currencySymbol)} disbursed and synced!`, 'success');
      setDisburseModalOpen(false);
      if (viewPO?.id === poToDisburse.id) {
        setViewPO({
          ...viewPO,
          paidAmount: newPaid,
          balanceAmount: newBalance,
          paymentStatus: newStatus,
        });
      }
      setPoToDisburse(null);
    } catch (err: any) {
      showToast(err.message || 'Failed to record disbursement.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Purchase Return (Debit Note)
  const handleProcessReturn = async () => {
    if (!poToReturn) return;
    if (!returnReason.trim()) {
      showToast('Please provide a reason for the return.', 'error');
      return;
    }

    const itemsToReturn = Object.entries(returnQuantities)
      .map(([productId, qty]) => {
        const it = poToReturn.items.find((i) => i.productId === productId);
        return { item: it, quantity: qty };
      })
      .filter((x) => x.item && x.quantity > 0);

    if (itemsToReturn.length === 0) {
      showToast('Please specify a return quantity of at least 1 item.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const nowStr = new Date().toISOString();
      let totalReturnCost = 0;

      // Deduct returned items from inventory
      for (const { item, quantity } of itemsToReturn) {
        if (!item) continue;
        const lineCost = item.unitCost * quantity;
        totalReturnCost += lineCost;

        await stockTxService.create({
          productId: item.productId,
          productName: item.productName,
          sku: item.sku,
          quantity,
          direction: 'out',
          type: 'purchase_return',
          reference: `RET-${poToReturn.poNumber}`,
          referenceType: 'purchase_return',
          date: nowStr.split('T')[0],
          cost: item.unitCost,
          totalCost: lineCost,
          userId: user?.uid || 'user-admin',
          userName: user?.displayName || 'Administrator',
          notes: `Purchase Return for PO #${poToReturn.poNumber}: ${returnReason}`,
        });

        const prod = products.find((p) => p.id === item.productId);
        if (prod) {
          await productService.update(item.productId, {
            currentStock: Math.max(0, prod.currentStock - quantity),
          });
        }
      }

      // Update PO items with returnedQuantity
      const updatedItems = poToReturn.items.map((it) => {
        const returnedNow = returnQuantities[it.productId] || 0;
        return {
          ...it,
          returnedQuantity: (it.returnedQuantity || 0) + returnedNow,
        };
      });

      // If cash refund chosen, deposit into account
      if (returnRefundMode === 'cash_refund') {
        const acc = accounts[0];
        if (acc) {
          await accountService.update(acc.id, {
            currentBalance: (acc.currentBalance || 0) + totalReturnCost,
          });

          await paymentService.create({
            paymentNumber: `RET-DISB-${Date.now().toString().slice(-5)}`,
            partyType: 'supplier',
            partyId: poToReturn.supplierId,
            partyName: poToReturn.supplierName,
            type: 'receipt',
            amount: totalReturnCost,
            date: nowStr.split('T')[0],
            accountId: acc.id,
            accountName: acc.accountName,
            paymentMethod: 'cash',
            reference: `RET-${poToReturn.poNumber}`,
            purchaseOrderId: poToReturn.id,
            purchaseOrderNumber: poToReturn.poNumber,
            notes: `Cash refund from supplier for returned items on PO #${poToReturn.poNumber}`,
            status: 'active',
          });
        }
      } else {
        // Return credited against supplier payable account
        const supp = suppliers.find((s) => s.id === poToReturn.supplierId);
        if (supp) {
          await supplierService.update(supp.id, {
            currentBalance: Math.max(0, (supp.currentBalance || 0) - totalReturnCost),
          });
        }
      }

      await updateItem(poToReturn.id, {
        items: updatedItems,
        purchaseStatus: 'returned',
        returnReason,
        returnDate: nowStr,
      });

      // Audit Log
      await auditLogService.create({
        action: 'UPDATE',
        module: 'Purchases',
        entityId: poToReturn.poNumber,
        entityName: poToReturn.supplierName,
        description: `Processed Purchase Return (Debit Note) on PO #${poToReturn.poNumber} ($${totalReturnCost.toFixed(2)})`,
        userId: user?.uid || 'system',
        userName: user?.displayName || 'Administrator',
        userEmail: user?.email || 'admin@erp.com',
        timestamp: nowStr,
      });

      showToast(`Purchase Return recorded! Inventory deducted and supplier debit note generated.`, 'success');
      setReturnModalOpen(false);
      setPoToReturn(null);
      setReturnReason('');
      setReturnQuantities({});
      if (viewPO?.id === poToReturn.id) {
        setViewPO(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to process return';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered Purchases by tab, supplier, payment status, date range
  const filteredPurchases = useMemo(() => {
    return purchases.filter((po) => {
      // Lifecycle Tab
      const effectiveStatus = po.purchaseStatus || (po.receiptStatus === 'received' ? 'received' : 'draft');
      if (lifecycleTab === 'received' && effectiveStatus !== 'received') return false;
      if (lifecycleTab === 'draft' && effectiveStatus !== 'draft') return false;
      if (lifecycleTab === 'pending' && (po.receiptStatus !== 'pending' || effectiveStatus === 'void')) return false;
      if (lifecycleTab === 'returned' && effectiveStatus !== 'returned') return false;
      if (lifecycleTab === 'void' && effectiveStatus !== 'void') return false;

      // Supplier Filter
      if (supplierFilter !== 'all' && po.supplierId !== supplierFilter) return false;

      // Payment Status Filter
      if (paymentStatusFilter !== 'all' && po.paymentStatus !== paymentStatusFilter) return false;

      // Date Range
      if (dateFrom && po.date < dateFrom) return false;
      if (dateTo && po.date > dateTo) return false;

      return true;
    });
  }, [purchases, lifecycleTab, supplierFilter, paymentStatusFilter, dateFrom, dateTo]);

  // High-level KPI Computations (Excluding draft and void)
  const stats = useMemo(() => {
    const validPurchases = allPurchases.filter(
      (p) => p.purchaseStatus !== 'draft' && p.purchaseStatus !== 'void'
    );
    const totalPurchased = validPurchases.reduce((acc, p) => acc + (p.totalAmount || 0), 0);
    const totalDisbursed = validPurchases.reduce((acc, p) => acc + (p.paidAmount || 0), 0);
    const totalPayable = validPurchases.reduce((acc, p) => acc + (p.balanceAmount || 0), 0);
    const draftsCount = allPurchases.filter((p) => p.purchaseStatus === 'draft').length;
    return {
      totalPurchased,
      totalDisbursed,
      totalPayable,
      draftsCount,
      count: validPurchases.length,
    };
  }, [allPurchases]);

  // Columns for DataTable
  const columns: Column<PurchaseOrder>[] = [
    {
      header: 'PO #',
      accessor: 'poNumber',
      sortable: true,
      cell: (po) => (
        <button
          onClick={() => setViewPO(po)}
          className="font-mono font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1.5"
        >
          <FileText className="w-3.5 h-3.5" />
          {po.poNumber}
        </button>
      ),
    },
    {
      header: 'Date',
      accessor: 'date',
      sortable: true,
      cell: (po) => formatDate(po.date),
    },
    {
      header: 'Supplier',
      accessor: 'supplierName',
      sortable: true,
      cell: (po) => (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 text-xs font-bold">
            {po.supplierName?.slice(0, 1) || 'S'}
          </div>
          <span className="font-medium text-slate-900">{po.supplierName}</span>
        </div>
      ),
    },
    {
      header: 'Order Status',
      accessor: 'purchaseStatus',
      cell: (po) => {
        const st = po.purchaseStatus || (po.receiptStatus === 'received' ? 'received' : 'draft');
        if (st === 'void') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
              <Ban className="w-3 h-3" /> Void / Cancelled
            </span>
          );
        }
        if (st === 'returned') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
              <RotateCcw className="w-3 h-3" /> Returned
            </span>
          );
        }
        if (st === 'draft') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
              <Edit3 className="w-3 h-3" /> Draft
            </span>
          );
        }
        if (po.receiptStatus === 'pending') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <Clock className="w-3 h-3" /> Pending Delivery
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" /> Received (Stock +)
          </span>
        );
      },
    },
    {
      header: 'Total Cost',
      accessor: 'totalAmount',
      sortable: true,
      cell: (po) => (
        <span className={`font-semibold ${po.purchaseStatus === 'void' ? 'line-through text-slate-400' : 'text-slate-900'}`}>
          {formatCurrency(po.totalAmount || 0, currencyCode, currencySymbol)}
        </span>
      ),
    },
    {
      header: 'Paid Amount',
      accessor: 'paidAmount',
      sortable: true,
      cell: (po) => (
        <span className="text-emerald-700 font-medium">
          {formatCurrency(po.paidAmount || 0, currencyCode, currencySymbol)}
        </span>
      ),
    },
    {
      header: 'Payable Due',
      accessor: 'balanceAmount',
      sortable: true,
      cell: (po) => (
        <span
          className={`font-semibold ${
            (po.balanceAmount || 0) > 0 ? 'text-amber-700' : 'text-slate-500'
          }`}
        >
          {formatCurrency(po.balanceAmount || 0, currencyCode, currencySymbol)}
        </span>
      ),
    },
    {
      header: 'Payment Status',
      accessor: 'paymentStatus',
      cell: (po) => {
        if (po.purchaseStatus === 'void') {
          return <span className="text-xs text-slate-400 italic">Reversed</span>;
        }
        if (po.paymentStatus === 'paid') {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3" /> Paid
            </span>
          );
        }
        if (po.paymentStatus === 'partial') {
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <Clock className="w-3 h-3" /> Partial
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle className="w-3 h-3" /> Unpaid
          </span>
        );
      },
    },
    {
      header: 'Actions',
      cell: (po) => {
        const isDraft = po.purchaseStatus === 'draft';
        const isVoid = po.purchaseStatus === 'void';
        const isPending = po.receiptStatus === 'pending' && !isVoid && !isDraft;
        const isReceived = po.receiptStatus === 'received' && !isVoid && !isDraft;

        return (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setViewPO(po)}
              title="View PO Details"
            >
              <Eye className="w-4 h-4 text-slate-600" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => printCommercialPurchaseOrder(po, currentTenant)}
              title="Print or Save PDF"
            >
              <Printer className="w-4 h-4 text-indigo-600" />
            </Button>

            {isPending && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleReceiveShipment(po)}
                title="Receive Shipment & Restock"
                className="text-emerald-600 hover:bg-emerald-50"
              >
                <Package className="w-4 h-4" />
              </Button>
            )}

            {isDraft && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleOpenEditDraftModal(po)}
                title="Edit Draft PO"
                className="text-amber-600 hover:bg-amber-50"
              >
                <Edit3 className="w-4 h-4" />
              </Button>
            )}

            {isReceived && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPoToReturn(po);
                  setReturnQuantities({});
                  setReturnReason('');
                  setReturnModalOpen(true);
                }}
                title="Purchase Return (Debit Note)"
                className="text-purple-600 hover:bg-purple-50"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}

            {po.balanceAmount > 0 && !isDraft && !isVoid && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleOpenDisbursePaymentModal(po)}
                title="Pay Supplier (Disburse Payment)"
                className="text-emerald-600 hover:bg-emerald-50"
              >
                <DollarSign className="w-4 h-4" />
              </Button>
            )}

            {!isDraft && !isVoid && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setPoToVoid(po);
                  setVoidReason('');
                  setVoidModalOpen(true);
                }}
                title="Void / Cancel Purchase Order"
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
                  if (confirm(`Are you sure you want to delete draft purchase order ${po.poNumber}?`)) {
                    softDeleteItem(po.id);
                    showToast(`Draft PO ${po.poNumber} removed.`, 'info');
                  }
                }}
                title="Delete Draft PO"
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
        title="Purchase Orders & Procurement"
        description="Supplier procurement, automatic stock inward receipts, accounts payable, debit notes, and disbursement tracking."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Purchases' },
        ]}
        actions={
          <Button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Create Purchase Order
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Purchases
            </span>
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-2 font-mono">
            {formatCurrency(stats.totalPurchased, currencyCode, currencySymbol)}
          </div>
          <div className="text-xs text-slate-500 mt-1">From {stats.count} procurement orders</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Disbursed
            </span>
            <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-2 font-mono">
            {formatCurrency(stats.totalDisbursed, currencyCode, currencySymbol)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Paid to suppliers</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Accounts Payable
            </span>
            <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-700 mt-2 font-mono">
            {formatCurrency(stats.totalPayable, currencyCode, currencySymbol)}
          </div>
          <div className="text-xs text-slate-500 mt-1">Outstanding supplier obligations</div>
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
          <div className="text-xs text-slate-500 mt-1">Unposted draft purchase orders</div>
        </div>
      </div>

      {/* Lifecycle Filter Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
        {[
          { id: 'all', label: 'All Purchases' },
          { id: 'received', label: 'Received / Final' },
          { id: 'pending', label: 'Pending Delivery' },
          { id: 'draft', label: 'Drafts' },
          { id: 'returned', label: 'Returned / Debit Note' },
          { id: 'void', label: 'Cancelled / Void' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setLifecycleTab(tab.id as any)}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
              lifecycleTab === tab.id
                ? 'border-indigo-600 text-indigo-600 font-bold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Secondary Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-48">
            <Select
              options={[
                { label: 'All Suppliers', value: 'all' },
                ...suppliers.map((s) => ({ label: s.name, value: s.id })),
              ]}
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
            />
          </div>

          <div className="w-44">
            <Select
              options={[
                { label: 'Payment: All', value: 'all' },
                { label: 'Paid', value: 'paid' },
                { label: 'Partial', value: 'partial' },
                { label: 'Unpaid', value: 'unpaid' },
              ]}
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value as any)}
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
          Showing {filteredPurchases.length} of {allPurchases.length} orders
        </div>
      </div>

      {/* DataTable */}
      <DataTable<PurchaseOrder>
        data={filteredPurchases}
        columns={columns}
        loading={loading}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        totalCount={filteredPurchases.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSortChange={(field: string) => setSortBy(field)}
      />

      {/* CREATE / EDIT PURCHASE ORDER MODAL */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => {
          setCreateModalOpen(false);
          resetForm();
        }}
        title={editingPO ? `Edit Draft Purchase Order (${editingPO.poNumber})` : 'Create New Purchase Order'}
        description={
          editingPO
            ? 'Modify line items, pricing, discounts, and payment terms before posting.'
            : 'Procure products from suppliers, specify receipt condition, and choose between draft quotation or posted receipt.'
        }
        maxWidth="4xl"
      >
        <form onSubmit={(e) => { e.preventDefault(); handleSubmitPO(false); }} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Number *</label>
              <Input
                type="text"
                value={poNumberInput}
                onChange={(e) => setPoNumberInput(e.target.value)}
                placeholder="e.g. PO-10025"
                required
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700">Supplier *</label>
                {supplierSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setSupplierSearchQuery('')}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search supplier..."
                  value={supplierSearchQuery}
                  onChange={(e) => setSupplierSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
              </div>
              <Select
                options={[
                  { label: `-- Choose Supplier (${filteredSuppliers.length}) --`, value: '' },
                  ...filteredSuppliers.map((s) => ({ label: `${s.name} (${s.code})`, value: s.id })),
                ]}
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">PO Date *</label>
              <Input
                type="date"
                value={poDate}
                onChange={(e) => setPoDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Due Date</label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Goods Receipt Status</label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer ${
                  receiptStatus === 'received'
                    ? 'border-emerald-600 bg-emerald-50/50'
                    : 'border-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="receiptStatus"
                  checked={receiptStatus === 'received'}
                  onChange={() => setReceiptStatus('received')}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Received (Stock Added Now)</span>
                  <span className="text-[11px] text-slate-500">Increments warehouse inventory immediately</span>
                </div>
              </label>

              <label
                className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer ${
                  receiptStatus === 'pending'
                    ? 'border-amber-600 bg-amber-50/50'
                    : 'border-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="receiptStatus"
                  checked={receiptStatus === 'pending'}
                  onChange={() => setReceiptStatus('pending')}
                  className="text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Pending Delivery</span>
                  <span className="text-[11px] text-slate-500">Stock will be added later when shipment is received</span>
                </div>
              </label>
            </div>
          </div>

          {/* Line Items Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Procurement Items</h4>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleAddLineItem}
                className="text-xs flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Item
              </Button>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2 px-2 text-center w-8">#</th>
                    <th className="py-2 px-3 text-left">Product</th>
                    <th className="py-2 px-2 text-right">In Stock</th>
                    <th className="py-2 px-2 text-right">Qty</th>
                    <th className="py-2 px-2 text-right">Unit Cost ({currencySymbol})</th>
                    <th className="py-2 px-2 text-right">Disc (%)</th>
                    <th className="py-2 px-2 text-right">Tax (%)</th>
                    <th className="py-2 px-3 text-right">Total ({currencySymbol})</th>
                    <th className="py-2 px-2 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lineItems.map((item, idx) => {
                    const gross = item.quantity * item.unitCost;
                    const lineDisc = gross * ((item.discountPercent || 0) / 100);
                    const net = Math.max(0, gross - lineDisc);
                    const itemTax = (net * (item.taxRate || 0)) / 100;
                    const lineTotal = net + itemTax;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2 px-2 text-center font-bold font-mono text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3">
                          <select
                            className="w-full text-xs border border-slate-300 rounded px-2 py-1 bg-white"
                            value={item.productId}
                            onChange={(e) => handleUpdateLineItem(idx, { productId: e.target.value })}
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.sku})
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-slate-500">{item.currentStock}</td>
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            min="1"
                            className="w-16 text-right text-xs border border-slate-300 rounded px-2 py-1"
                            value={item.quantity}
                            onChange={(e) => handleUpdateLineItem(idx, { quantity: parseInt(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            className="w-20 text-right text-xs border border-slate-300 rounded px-2 py-1"
                            value={item.unitCost}
                            onChange={(e) => handleUpdateLineItem(idx, { unitCost: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="100"
                            className="w-16 text-right text-xs border border-slate-300 rounded px-2 py-1"
                            value={item.discountPercent || ''}
                            placeholder="0%"
                            onChange={(e) => handleUpdateLineItem(idx, { discountPercent: parseFloat(e.target.value) || 0 })}
                          />
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-slate-600">{item.taxRate}%</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                          {formatCurrency(lineTotal, currencyCode, currencySymbol)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLineItem(idx)}
                            className="text-slate-400 hover:text-rose-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment & Settlement Selection: Prompt 7 Payment Types */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Payment Type & Settlement</h4>
              <span className="text-[11px] text-slate-500 font-medium">Select financial settlement method</span>
            </div>

            {/* 4 Payment Types Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <label
                className={`p-3 rounded-lg border cursor-pointer flex flex-col justify-between transition-all ${
                  purchaseType === 'credit'
                    ? 'border-amber-600 bg-amber-50/70 shadow-2xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="purchaseType"
                    checked={purchaseType === 'credit'}
                    onChange={() => setPurchaseType('credit')}
                    className="text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-xs font-bold text-slate-800">Credit (On Account)</span>
                </div>
                <span className="text-[11px] text-slate-500 mt-1">
                  100% payable balance to supplier ledger
                </span>
              </label>

              <label
                className={`p-3 rounded-lg border cursor-pointer flex flex-col justify-between transition-all ${
                  purchaseType === 'cash'
                    ? 'border-emerald-600 bg-emerald-50/70 shadow-2xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="purchaseType"
                    checked={purchaseType === 'cash'}
                    onChange={() => {
                      setPurchaseType('cash');
                      setPaymentMethod('cash');
                    }}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-bold text-slate-800">Cash Purchase</span>
                </div>
                <span className="text-[11px] text-slate-500 mt-1">
                  100% paid immediately from Cash in hand
                </span>
              </label>

              <label
                className={`p-3 rounded-lg border cursor-pointer flex flex-col justify-between transition-all ${
                  purchaseType === 'bank'
                    ? 'border-indigo-600 bg-indigo-50/70 shadow-2xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="purchaseType"
                    checked={purchaseType === 'bank'}
                    onChange={() => {
                      setPurchaseType('bank');
                      setPaymentMethod('bank_transfer');
                    }}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-bold text-slate-800">Bank Transfer</span>
                </div>
                <span className="text-[11px] text-slate-500 mt-1">
                  100% paid immediately via Bank account
                </span>
              </label>

              <label
                className={`p-3 rounded-lg border cursor-pointer flex flex-col justify-between transition-all ${
                  purchaseType === 'partial'
                    ? 'border-purple-600 bg-purple-50/70 shadow-2xs'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="purchaseType"
                    checked={purchaseType === 'partial'}
                    onChange={() => setPurchaseType('partial')}
                    className="text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-xs font-bold text-slate-800">Partial Payment</span>
                </div>
                <span className="text-[11px] text-slate-500 mt-1">
                  Pay down payment now, rest on credit
                </span>
              </label>
            </div>

            {/* Conditional Account & Method Inputs */}
            {purchaseType !== 'credit' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-200">
                {purchaseType === 'partial' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Down Payment Amount ({currencySymbol}) *
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max={totalAmount}
                      placeholder="0.00"
                      value={partialAmount}
                      onChange={(e) => setPartialAmount(e.target.value)}
                    />
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Disbursement Account *</label>
                  <Select
                    options={accounts.map((a) => ({
                      label: `${a.accountName} (${formatCurrency(a.currentBalance, currencyCode, currencySymbol)})`,
                      value: a.id,
                    }))}
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">Payment Method</label>
                  <Select
                    options={[
                      { label: 'Bank Transfer', value: 'bank_transfer' },
                      { label: 'Cash', value: 'cash' },
                      { label: 'Credit Card', value: 'credit_card' },
                      { label: 'Cheque', value: 'cheque' },
                    ]}
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Notes, Discounts & Order Summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Order Notes / Terms</label>
                <textarea
                  rows={3}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-1 focus:ring-indigo-500"
                  placeholder="Supplier terms, shipment tracking, delivery instructions..."
                  value={poNotes}
                  onChange={(e) => setPoNotes(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Global Purchase Discount ({currencySymbol})
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={globalDiscount}
                  onChange={(e) => setGlobalDiscount(e.target.value)}
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Flat overall purchase discount deducted from order total.
                </span>
              </div>
            </div>

            <div className="bg-slate-100 p-4 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Items Subtotal:</span>
                <span className="font-mono">{formatCurrency(lineSubtotal, currencyCode, currencySymbol)}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Total Discount:</span>
                  <span className="font-mono">-{formatCurrency(totalDiscount, currencyCode, currencySymbol)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Tax:</span>
                <span className="font-mono">+{formatCurrency(taxAmount, currencyCode, currencySymbol)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Grand Total:</span>
                <span className="font-mono text-indigo-700">{formatCurrency(totalAmount, currencyCode, currencySymbol)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-semibold pt-1">
                <span>Paid Amount:</span>
                <span className="font-mono">{formatCurrency(paidAmountCalculated, currencyCode, currencySymbol)}</span>
              </div>
              <div className="flex justify-between text-amber-700 font-semibold">
                <span>Remaining Payable Due:</span>
                <span className="font-mono">{formatCurrency(balanceAmountCalculated, currencyCode, currencySymbol)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleSubmitPO(true)}
              disabled={submitting}
              className="border-slate-300 text-slate-700"
            >
              {editingPO ? 'Save Changes as Draft' : 'Save as Draft Quotation'}
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
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {submitting
                  ? 'Processing...'
                  : editingPO
                  ? 'Post Order & Confirm Procurement'
                  : 'Post Order & Confirm Procurement'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      {/* QUICK DISBURSE PAYMENT MODAL */}
      <Modal
        isOpen={disburseModalOpen}
        onClose={() => {
          setDisburseModalOpen(false);
          setPoToDisburse(null);
        }}
        title={`Disburse Payment - ${poToDisburse?.poNumber || ''}`}
        maxWidth="md"
      >
        {poToDisburse && (
          <div className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs flex justify-between items-center">
              <div>
                <span className="text-slate-500 block">Supplier:</span>
                <span className="font-bold text-slate-800 text-sm">{poToDisburse.supplierName}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block">Balance Due:</span>
                <span className="font-bold font-mono text-rose-600 text-base">
                  {formatCurrency(poToDisburse.balanceAmount, currencyCode, currencySymbol)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Disbursement Amount ({currencySymbol}) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={poToDisburse.balanceAmount}
                value={disburseAmount}
                onChange={(e) => setDisburseAmount(e.target.value)}
                className="w-full text-sm font-mono font-bold px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="0.00"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                Total PO: {formatCurrency(poToDisburse.totalAmount, currencyCode, currencySymbol)} | Already Paid: {formatCurrency(poToDisburse.paidAmount, currencyCode, currencySymbol)}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Disburse From Account *
              </label>
              <select
                value={disburseAccountId}
                onChange={(e) => setDisburseAccountId(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                {accounts
                  .filter((a) => a.status === 'active' && !a.isDeleted)
                  .map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.accountName} ({acc.type?.toUpperCase() || 'BANK'}) - Bal: {formatCurrency(acc.currentBalance || 0, currencyCode, currencySymbol)}
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={disburseMethod}
                  onChange={(e) => setDisburseMethod(e.target.value as any)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="credit_card">Credit / Debit Card</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Payment Reference</label>
                <input
                  type="text"
                  value={disburseRef}
                  onChange={(e) => setDisburseRef(e.target.value)}
                  placeholder="e.g. Cheque / Txn Ref"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDisburseModalOpen(false);
                  setPoToDisburse(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmDisbursePayment}
                disabled={submitting || !parseFloat(disburseAmount) || parseFloat(disburseAmount) <= 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {submitting ? 'Disbursing...' : 'Confirm Disbursement'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* VIEW PURCHASE ORDER MODAL */}
      {viewPO && (
        <Modal
          isOpen={Boolean(viewPO)}
          onClose={() => setViewPO(null)}
          title={`Purchase Order ${viewPO.poNumber}`}
          description={`Procurement details and line items for ${viewPO.supplierName}`}
          maxWidth="3xl"
        >
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Supplier</span>
                <span className="text-sm font-bold text-slate-900">{viewPO.supplierName}</span>
                <span className="text-xs text-slate-500 block mt-0.5">Date: {formatDate(viewPO.date)}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Order Status</span>
                <span className="inline-flex items-center gap-1 font-bold text-xs">
                  {viewPO.purchaseStatus === 'void' ? (
                    <span className="text-rose-600 flex items-center gap-1"><Ban className="w-3.5 h-3.5" /> Void / Cancelled</span>
                  ) : viewPO.purchaseStatus === 'returned' ? (
                    <span className="text-purple-600 flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5" /> Returned</span>
                  ) : viewPO.receiptStatus === 'received' ? (
                    <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Goods Received</span>
                  ) : (
                    <span className="text-amber-600 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Pending Delivery</span>
                  )}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Grand Total</span>
                <span className="text-base font-bold text-slate-900 font-mono">
                  {formatCurrency(viewPO.totalAmount, currencyCode, currencySymbol)}
                </span>
              </div>
            </div>

            {viewPO.voidReason && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Cancelled on {formatDate(viewPO.voidDate || '')}: </span>
                  {viewPO.voidReason}
                </div>
              </div>
            )}

            {/* Line Items Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-2 text-center w-8">#</th>
                    <th className="py-2.5 px-3 text-left">Item / SKU</th>
                    <th className="py-2.5 px-3 text-right">Quantity</th>
                    <th className="py-2.5 px-3 text-right">Unit Cost</th>
                    <th className="py-2.5 px-3 text-right">Returned</th>
                    <th className="py-2.5 px-3 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewPO.items.map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-2 text-center font-bold font-mono text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800">{it.productName}</div>
                        <div className="text-[10px] font-mono text-slate-400">{it.sku}</div>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">{it.quantity}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatCurrency(it.unitCost, currencyCode, currencySymbol)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-purple-700">
                        {it.returnedQuantity ? `${it.returnedQuantity} units` : '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(it.total, currencyCode, currencySymbol)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => printCommercialPurchaseOrder(viewPO, currentTenant)}
                  className="flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" /> Print PO
                </Button>

                {viewPO.receiptStatus === 'pending' && viewPO.purchaseStatus !== 'void' && (
                  <Button
                    size="sm"
                    onClick={() => handleReceiveShipment(viewPO)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5"
                  >
                    <Package className="w-3.5 h-3.5" /> Receive Shipment
                  </Button>
                )}

                {viewPO.balanceAmount > 0 && viewPO.purchaseStatus !== 'void' && viewPO.purchaseStatus !== 'draft' && (
                  <Button
                    size="sm"
                    onClick={() => handleOpenDisbursePaymentModal(viewPO)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"
                  >
                    <DollarSign className="w-3.5 h-3.5" /> Pay Supplier
                  </Button>
                )}
              </div>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setViewPO(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* VOID / CANCEL MODAL */}
      {voidModalOpen && poToVoid && (
        <Modal
          isOpen={voidModalOpen}
          onClose={() => setVoidModalOpen(false)}
          title={`Cancel Purchase Order ${poToVoid.poNumber}`}
          description="Cancelling will reverse inward stock transactions, decrement warehouse stock, and credit back disbursements."
          maxWidth="lg"
        >
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Financial Accounting Policy:</strong> Official orders cannot be simply deleted. Cancelling generates counter-balancing stock and payment reversals to maintain clean double-entry audit trails.
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Cancellation *
              </label>
              <textarea
                rows={3}
                className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-1 focus:ring-rose-500"
                placeholder="e.g., Supplier cancelled order, incorrect pricing, duplicate procurement..."
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
                onClick={handleVoidPO}
                disabled={submitting}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {submitting ? 'Reversing...' : 'Confirm Cancellation & Reverse Stock'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* PURCHASE RETURN (DEBIT NOTE) MODAL */}
      {returnModalOpen && poToReturn && (
        <Modal
          isOpen={returnModalOpen}
          onClose={() => setReturnModalOpen(false)}
          title={`Return Goods to Supplier (Debit Note) - ${poToReturn.poNumber}`}
          description="Specify defective or returned item quantities to deduct from warehouse stock and claim credit from supplier."
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2 px-3 text-left">Product</th>
                    <th className="py-2 px-2 text-right">Delivered</th>
                    <th className="py-2 px-2 text-right">Already Returned</th>
                    <th className="py-2 px-3 text-right">Return Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {poToReturn.items.map((it) => {
                    const alreadyRet = it.returnedQuantity || 0;
                    const maxReturnable = Math.max(0, it.quantity - alreadyRet);
                    return (
                      <tr key={it.productId}>
                        <td className="py-2 px-3">
                          <span className="font-semibold text-slate-800">{it.productName}</span>
                          <span className="text-[10px] font-mono text-slate-400 block">{it.sku}</span>
                        </td>
                        <td className="py-2 px-2 text-right font-mono">{it.quantity}</td>
                        <td className="py-2 px-2 text-right font-mono text-purple-700">{alreadyRet}</td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            max={maxReturnable}
                            className="w-20 text-right text-xs border border-slate-300 rounded px-2 py-1"
                            placeholder="0"
                            value={returnQuantities[it.productId] || ''}
                            onChange={(e) => {
                              const v = parseInt(e.target.value) || 0;
                              setReturnQuantities({
                                ...returnQuantities,
                                [it.productId]: Math.min(v, maxReturnable),
                              });
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Return Reason *</label>
                <textarea
                  rows={2}
                  className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-purple-500"
                  placeholder="e.g., Damaged on arrival, quality inspection failure..."
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier Compensation Mode</label>
                <div className="space-y-2 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="refundMode"
                      checked={returnRefundMode === 'credit_account'}
                      onChange={() => setReturnRefundMode('credit_account')}
                    />
                    <span>Debit Note (Credit to Supplier Ledger)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="refundMode"
                      checked={returnRefundMode === 'cash_refund'}
                      onChange={() => setReturnRefundMode('cash_refund')}
                    />
                    <span>Cash / Bank Refund Received</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <Button
                variant="ghost"
                onClick={() => setReturnModalOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleProcessReturn}
                disabled={submitting}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {submitting ? 'Processing...' : 'Complete Return & Deduct Stock'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

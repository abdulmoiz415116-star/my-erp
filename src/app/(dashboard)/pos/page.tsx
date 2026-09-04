'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useTenant } from '@/context/TenantContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  ProductService,
  CustomerService,
  SaleService,
  StockTransactionService,
  PaymentService,
  AccountService,
  CategoryService,
  AuditLogService,
  validateStockDeduction,
} from '@/services/erp.service';
import { Product, Customer, Account, Category, SaleInvoice, SaleInvoiceItem } from '@/types/erp';
import { useRealtimeCollection } from '@/hooks/useRealtimeCollection';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { formatCurrency } from '@/lib/utils';
import { printThermalReceipt } from '@/lib/pdfPrint';
import {
  Search,
  Barcode,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  DollarSign,
  CreditCard,
  Building2,
  Printer,
  CheckCircle2,
  User,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Layers,
} from 'lucide-react';

interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export default function PosPage() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const { showToast } = useToast();

  const tenantId = currentTenant?.id || 'demo_tenant';
  const currencySymbol = currentTenant?.settings?.currencySymbol || '$';
  const currencyCode = currentTenant?.settings?.currency || 'USD';

  // Live collections
  const { allItems: products } = useRealtimeCollection<Product>((tId) => new ProductService(tId));
  const { allItems: categories } = useRealtimeCollection<Category>((tId) => new CategoryService(tId));
  const { allItems: customers } = useRealtimeCollection<Customer>((tId) => new CustomerService(tId));
  const { allItems: accounts } = useRealtimeCollection<Account>((tId) => new AccountService(tId));

  // Active state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('walk-in');
  const [discountPercent, setDiscountPercent] = useState<number>(0);

  // Settlement Modal
  const [isTenderModalOpen, setIsTenderModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit_card' | 'bank_transfer'>('cash');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [tenderedAmount, setTenderedAmount] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Last Completed Sale (for reprint)
  const [lastCompletedSale, setLastCompletedSale] = useState<{
    invoice: SaleInvoice;
    tendered: number;
    change: number;
    method: string;
  } | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Default cash account setup
  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      const defaultCash = accounts.find((a) => a.type === 'cash' || a.isDefault) || accounts[0];
      setSelectedAccountId(defaultCash.id);
    }
  }, [accounts, selectedAccountId]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (p.isDeleted || p.status === 'inactive') return false;
      const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q));
      return matchesCat && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  // Cart Calculations
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [cart]);

  const cartTax = useMemo(() => {
    return cart.reduce((sum, item) => {
      const lineSubtotal = item.unitPrice * item.quantity;
      return sum + (lineSubtotal * (item.taxRate || 0)) / 100;
    }, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    return (cartSubtotal * (discountPercent || 0)) / 100;
  }, [cartSubtotal, discountPercent]);

  const cartTotal = useMemo(() => {
    return Math.max(0, cartSubtotal - discountAmount + cartTax);
  }, [cartSubtotal, discountAmount, cartTax]);

  // Auto Tender Amount setup when opening modal
  const handleOpenTender = () => {
    if (cart.length === 0) {
      showToast('Cart is empty. Add products before checking out.', 'error');
      return;
    }
    setTenderedAmount(cartTotal.toFixed(2));
    setIsTenderModalOpen(true);
  };

  const parsedTendered = parseFloat(tenderedAmount) || 0;
  const changeDue = Math.max(0, parsedTendered - cartTotal);

  // Add product to cart (or barcode auto-add)
  const addToCart = (product: Product) => {
    const existingIndex = cart.findIndex((item) => item.product.id === product.id);
    const currentCartQty = existingIndex > -1 ? cart[existingIndex].quantity : 0;

    const validation = validateStockDeduction(
      product.name,
      product.currentStock,
      currentCartQty + 1,
      currentTenant?.settings?.allowNegativeInventory ?? false
    );

    if (!validation.isValid) {
      showToast(validation.error || 'Insufficient stock for this product.', 'error');
      return;
    }

    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          product,
          quantity: 1,
          unitPrice: product.sellingPrice,
          taxRate: product.taxRate || 0,
        },
      ]);
    }
  };

  const updateCartQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(index);
      return;
    }
    const item = cart[index];
    const validation = validateStockDeduction(
      item.product.name,
      item.product.currentStock,
      newQty,
      currentTenant?.settings?.allowNegativeInventory ?? false
    );
    if (!validation.isValid) {
      showToast(validation.error || 'Insufficient stock for requested quantity.', 'error');
      return;
    }
    const updated = [...cart];
    updated[index].quantity = newQty;
    setCart(updated);
  };

  const removeFromCart = (index: number) => {
    const updated = cart.filter((_, i) => i !== index);
    setCart(updated);
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    const exactMatch = products.find(
      (p) =>
        !p.isDeleted &&
        p.status !== 'inactive' &&
        (p.barcode?.toLowerCase() === searchQuery.toLowerCase().trim() ||
          p.sku.toLowerCase() === searchQuery.toLowerCase().trim())
    );

    if (exactMatch) {
      addToCart(exactMatch);
      setSearchQuery('');
      showToast(`Scanned: ${exactMatch.name}`, 'success');
    }
  };

  // Complete Sale & Trigger Invariants
  const handleCompleteSale = async () => {
    if (parsedTendered < cartTotal && paymentMethod === 'cash') {
      showToast(`Tendered cash ($${parsedTendered.toFixed(2)}) is less than total ($${cartTotal.toFixed(2)}).`, 'error');
      return;
    }

    setIsProcessing(true);

    try {
      const saleService = new SaleService(tenantId);
      const stockService = new StockTransactionService(tenantId);
      const productService = new ProductService(tenantId);
      const paymentService = new PaymentService(tenantId);
      const accountService = new AccountService(tenantId);

      const targetCustomer =
        selectedCustomerId !== 'walk-in'
          ? customers.find((c) => c.id === selectedCustomerId)
          : null;

      const customerName = targetCustomer ? targetCustomer.name : 'Walk-in Retail Customer';
      const customerId = targetCustomer ? targetCustomer.id : 'walk-in';

      const targetAccount = accounts.find((a) => a.id === selectedAccountId) || accounts[0];

      const invNumber = `INV-POS-${Math.floor(10000 + Math.random() * 90000)}`;
      const nowStr = new Date().toISOString();

      const invoiceItems: SaleInvoiceItem[] = cart.map((c) => ({
        productId: c.product.id,
        productName: c.product.name,
        sku: c.product.sku,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        costPrice: c.product.costPrice,
        taxRate: c.taxRate,
        taxAmount: (c.unitPrice * c.quantity * c.taxRate) / 100,
        subtotal: c.unitPrice * c.quantity,
        total: c.unitPrice * c.quantity * (1 + c.taxRate / 100),
      }));

      // 1. Create Sale Invoice
      const newInvoice: SaleInvoice = await saleService.create({
        invoiceNumber: invNumber,
        customerId,
        customerName,
        date: nowStr,
        dueDate: nowStr,
        items: invoiceItems,
        subtotal: cartSubtotal,
        taxAmount: cartTax,
        discountAmount: discountAmount,
        totalAmount: cartTotal,
        paidAmount: cartTotal,
        balanceAmount: 0,
        paymentStatus: 'paid',
        saleStatus: 'posted',
        saleType: 'cash',
        paymentMethod: paymentMethod,
        accountId: targetAccount.id,
        accountName: targetAccount.accountName,
        status: 'active',
        notes: `POS Quick Retail Checkout. Cashier: ${user?.displayName || 'Staff'}`,
      });

      // 2. Write Stock Transactions & decrement physical inventory
      for (const item of cart) {
        await stockService.create({
          productId: item.product.id,
          productName: item.product.name,
          sku: item.product.sku,
          quantity: item.quantity,
          direction: 'out',
          type: 'sale',
          reference: invNumber,
          referenceType: 'sale',
          date: nowStr,
          cost: item.product.costPrice,
          totalCost: item.product.costPrice * item.quantity,
          userId: user?.uid || 'pos-cashier',
          userName: user?.displayName || 'Cashier',
          location: 'Retail Store',
          notes: `POS Retail Sale to ${customerName}`,
        });

        // Decrement Product stock
        const currentProd = products.find((p) => p.id === item.product.id);
        if (currentProd) {
          await productService.update(item.product.id, {
            currentStock: Math.max(0, currentProd.currentStock - item.quantity),
          });
        }
      }

      // 3. Record Payment & deposit into Account
      const paymentNumber = `PAY-POS-${Math.floor(10000 + Math.random() * 90000)}`;
      await paymentService.create({
        paymentNumber,
        partyType: 'customer',
        partyId: customerId,
        partyName: customerName,
        type: 'receipt',
        amount: cartTotal,
        date: nowStr,
        accountId: targetAccount.id,
        accountName: targetAccount.accountName,
        paymentMethod: paymentMethod,
        reference: invNumber,
        invoiceId: newInvoice.id,
        invoiceNumber: invNumber,
        notes: `POS Settlement via ${paymentMethod.replace('_', ' ').toUpperCase()}`,
        status: 'active',
      });

      // 4. Record Audit Log
      const auditLogService = new AuditLogService(tenantId);
      await auditLogService.create({
        action: 'CREATE',
        module: 'POS',
        entityId: invNumber,
        entityName: customerName,
        description: `POS Checkout #${invNumber} for ${customerName} (${formatCurrency(cartTotal, currencyCode, currencySymbol)})`,
        userId: user?.uid || 'pos-cashier',
        userName: user?.displayName || 'Cashier',
        userEmail: user?.email || 'cashier@erp.com',
        timestamp: nowStr,
      });

      // Credit Account balance
      await accountService.update(targetAccount.id, {
        currentBalance: (targetAccount.currentBalance || 0) + cartTotal,
      });

      // 4. Save Last Completed Sale for Instant Reprint
      setLastCompletedSale({
        invoice: newInvoice,
        tendered: parsedTendered,
        change: changeDue,
        method: paymentMethod,
      });

      // 5. Trigger Instant 80mm Thermal Receipt Print
      printThermalReceipt(
        newInvoice,
        parsedTendered,
        changeDue,
        paymentMethod,
        user?.displayName || 'Cashier',
        currentTenant
      );

      // Reset Cart and close modal
      setCart([]);
      setDiscountPercent(0);
      setIsTenderModalOpen(false);
      showToast(`Sale #${invNumber} completed! Change due: $${changeDue.toFixed(2)}`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to complete checkout.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col lg:flex-row gap-4 overflow-hidden">
      {/* LEFT AREA: Catalog & Fast Scanning */}
      <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Top Scanner & Search Bar */}
        <div className="p-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center gap-3">
          <form onSubmit={handleBarcodeSubmit} className="flex-1 relative min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={barcodeInputRef}
              type="text"
              placeholder="Scan Barcode, SKU, or search item name... (Enter to add)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-10 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              autoFocus
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
              <Barcode className="w-4 h-4" />
            </div>
          </form>

          {/* Quick Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full text-xs">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              All Items
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat.name
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 p-3.5 overflow-y-auto">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <Barcode className="w-12 h-12 mb-2 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">No products match your scan / filter</p>
              <p className="text-xs text-slate-400 mt-1">Try another barcode or clear search filter</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredProducts.map((p) => {
                const inCart = cart.find((it) => it.product.id === p.id);
                const isOutOfStock = p.currentStock <= 0;

                return (
                  <div
                    key={p.id}
                    onClick={() => !isOutOfStock && addToCart(p)}
                    className={`group relative p-3 rounded-xl border transition-all flex flex-col justify-between select-none cursor-pointer ${
                      isOutOfStock
                        ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                        : inCart
                        ? 'bg-indigo-50/40 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'bg-white border-slate-200/90 hover:border-indigo-400 hover:shadow-xs'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">
                          {p.sku}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                            p.currentStock <= p.minStockAlert
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {p.currentStock} {p.unit}
                        </span>
                      </div>
                      <h4 className="font-semibold text-slate-900 text-xs mt-1.5 line-clamp-2 leading-snug">
                        {p.name}
                      </h4>
                      {p.barcode && (
                        <span className="text-[9px] font-mono text-slate-400 block mt-0.5">
                          #{p.barcode}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-sm font-bold font-mono text-emerald-600">
                        {formatCurrency(p.sellingPrice, currencyCode, currencySymbol)}
                      </span>
                      {inCart ? (
                        <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                          {inCart.quantity}
                        </span>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-slate-100 group-hover:bg-indigo-600 group-hover:text-white text-slate-600 transition-colors flex items-center justify-center">
                          <Plus className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT AREA: Cart & Settlement Panel */}
      <div className="w-full lg:w-[410px] flex flex-col bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden shrink-0">
        {/* Customer Header */}
        <div className="p-3.5 border-b border-slate-200 bg-slate-900 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-600 rounded-lg">
                <ShoppingCart className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-sm">Active POS Register</span>
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              Items in Cart: <strong className="text-white">{cart.reduce((s, it) => s + it.quantity, 0)}</strong>
            </div>
          </div>

          <div className="mt-2.5">
            <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
              Select Customer
            </label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full py-1.5 px-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
            >
              <option value="walk-in">👤 Walk-in Retail Customer (Default)</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone || c.email || 'Account'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Cart Item Rows */}
        <div className="flex-1 overflow-y-auto p-3 divide-y divide-slate-100">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center py-12 text-slate-400">
              <ShoppingCart className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-600">Your POS cart is empty</p>
              <p className="text-[11px] text-slate-400 text-center max-w-[200px] mt-0.5">
                Scan or click on catalog items on the left to add them to checkout.
              </p>
            </div>
          ) : (
            cart.map((item, index) => (
              <div key={item.product.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                <div className="flex-1 min-w-0">
                  <h5 className="font-semibold text-slate-900 truncate leading-snug">
                    {item.product.name}
                  </h5>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                    {formatCurrency(item.unitPrice, currencyCode, currencySymbol)} x {item.quantity}
                  </div>
                </div>

                {/* Quantity Stepper */}
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
                  <button
                    onClick={() => updateCartQty(index, item.quantity - 1)}
                    className="w-5 h-5 flex items-center justify-center rounded bg-white text-slate-700 hover:bg-slate-200 shadow-2xs"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center font-mono font-bold text-xs text-slate-900">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateCartQty(index, item.quantity + 1)}
                    className="w-5 h-5 flex items-center justify-center rounded bg-white text-slate-700 hover:bg-slate-200 shadow-2xs"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Line Total */}
                <div className="text-right font-mono font-bold text-slate-900 w-16">
                  {formatCurrency(item.unitPrice * item.quantity, currencyCode, currencySymbol)}
                </div>

                <button
                  onClick={() => removeFromCart(index)}
                  className="text-slate-400 hover:text-rose-600 p-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Cart Totals & Settlement Action */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 space-y-2 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal:</span>
            <span className="font-mono">{formatCurrency(cartSubtotal, currencyCode, currencySymbol)}</span>
          </div>

          <div className="flex justify-between items-center text-slate-600">
            <span className="flex items-center gap-1">
              Discount (%):
            </span>
            <input
              type="number"
              min="0"
              max="100"
              value={discountPercent || ''}
              onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
              placeholder="0"
              className="w-16 py-0.5 px-1.5 text-right font-mono border border-slate-300 rounded bg-white text-xs"
            />
          </div>

          <div className="flex justify-between text-slate-600">
            <span>Estimated Tax:</span>
            <span className="font-mono">{formatCurrency(cartTax, currencyCode, currencySymbol)}</span>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-sm font-black text-slate-900">
            <span>TOTAL DUE:</span>
            <span className="font-mono text-xl text-indigo-600">
              {formatCurrency(cartTotal, currencyCode, currencySymbol)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm('Clear entire cart?')) setCart([]);
              }}
              disabled={cart.length === 0}
              className="text-slate-600 text-xs py-2"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Clear Cart
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenTender}
              disabled={cart.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 shadow-sm"
            >
              <DollarSign className="w-4 h-4 mr-1" /> Pay / Checkout
            </Button>
          </div>

          {/* Last Sale Quick Thermal Reprint */}
          {lastCompletedSale && (
            <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[11px] text-slate-500">
              <span>Last: #{lastCompletedSale.invoice.invoiceNumber}</span>
              <button
                onClick={() =>
                  printThermalReceipt(
                    lastCompletedSale.invoice,
                    lastCompletedSale.tendered,
                    lastCompletedSale.change,
                    lastCompletedSale.method,
                    user?.displayName || 'Cashier',
                    currentTenant
                  )
                }
                className="text-indigo-600 hover:underline flex items-center gap-1 font-medium"
              >
                <Printer className="w-3 h-3" /> Reprint Thermal Receipt
              </button>
            </div>
          )}
        </div>
      </div>

      {/* TENDER & PAYMENT SETTLEMENT MODAL */}
      <Modal
        isOpen={isTenderModalOpen}
        onClose={() => setIsTenderModalOpen(false)}
        title="POS Payment Tender & Receipt"
        size="md"
      >
        <div className="space-y-4">
          {/* Big Amount Banner */}
          <div className="p-4 rounded-xl bg-slate-900 text-white text-center">
            <span className="text-xs uppercase font-bold text-slate-400 tracking-wider block">
              Total Amount Payable
            </span>
            <div className="text-3xl font-black font-mono text-emerald-400 mt-1">
              {formatCurrency(cartTotal, currencyCode, currencySymbol)}
            </div>
          </div>

          {/* Tender Method Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 transition-colors ${
                  paymentMethod === 'cash'
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                <span>Cash</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('credit_card')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 transition-colors ${
                  paymentMethod === 'credit_card'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Credit Card</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('bank_transfer')}
                className={`py-2 px-3 rounded-lg border text-xs font-bold flex flex-col items-center gap-1 transition-colors ${
                  paymentMethod === 'bank_transfer'
                    ? 'bg-blue-50 border-blue-500 text-blue-700'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Bank/Wire</span>
              </button>
            </div>
          </div>

          {/* Deposit Account */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Deposit To Cash Drawer / Account
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="w-full py-2 px-3 border border-slate-300 rounded-lg text-xs bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.accountName} ({acc.type.toUpperCase()}) — Balance: {formatCurrency(acc.currentBalance, currencyCode, currencySymbol)}
                </option>
              ))}
            </select>
          </div>

          {/* Cash Tendered & Change Counter */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div>
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Amount Tendered ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={tenderedAmount}
                onChange={(e) => setTenderedAmount(e.target.value)}
                className="w-full py-1.5 px-2.5 font-mono text-base font-bold bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex flex-col justify-center text-right">
              <span className="text-[11px] font-bold text-slate-500 block">Change Due to Customer</span>
              <span
                className={`text-xl font-mono font-black mt-0.5 ${
                  changeDue > 0 ? 'text-emerald-600' : 'text-slate-800'
                }`}
              >
                {formatCurrency(changeDue, currencyCode, currencySymbol)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTenderModalOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCompleteSale}
              disabled={isProcessing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 py-2 px-4 shadow-sm"
            >
              <Printer className="w-4 h-4" />
              {isProcessing ? 'Processing...' : 'Complete & Print 80mm Receipt'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

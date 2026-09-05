'use client';

import React, { useState, useMemo } from 'react';
import { Product, StockTransaction, SaleInvoice, PurchaseOrder } from '@/types/erp';
import { generateProductStockLedger } from '@/services/erp.service';
import { printProductStockCard, printBarcodeLabels } from '@/lib/pdfPrint';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Package,
  ArrowUpRight,
  ArrowDownLeft,
  SlidersHorizontal,
  Barcode,
  Tag,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ShoppingCart,
  Layers,
  Calendar,
  User,
  Info,
  Printer,
  Download,
} from 'lucide-react';

interface ProductDetailModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  transactions: StockTransaction[];
  sales: SaleInvoice[];
  purchases: PurchaseOrder[];
  currentStock: number;
  currencySymbol: string;
  currency?: string;
  onAdjustStock?: (product: Product) => void;
}

type TabType = 'ledger' | 'sales' | 'purchases' | 'details';

export function ProductDetailModal({
  product,
  isOpen,
  onClose,
  transactions,
  sales,
  purchases,
  currentStock,
  currencySymbol,
  currency = 'USD',
  onAdjustStock,
}: ProductDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('ledger');

  const ledger = useMemo(() => {
    if (!product) return [];
    return generateProductStockLedger(product, transactions);
  }, [product, transactions]);

  const productSales = useMemo(() => {
    if (!product) return [];
    return sales.filter((s) => !s.isDeleted && s.items?.some((it) => it.productId === product.id));
  }, [product, sales]);

  const productPurchases = useMemo(() => {
    if (!product) return [];
    return purchases.filter((p) => !p.isDeleted && p.items?.some((it) => it.productId === product.id));
  }, [product, purchases]);

  if (!product) return null;

  const isLowStock = currentStock <= product.minStockAlert;
  const isOutOfStock = currentStock <= 0;
  const marginPercent =
    product.sellingPrice > 0
      ? (((product.sellingPrice - product.costPrice) / product.sellingPrice) * 100).toFixed(1)
      : '0.0';
  const totalValuation = currentStock * product.costPrice;

  const getTypeBadge = (type: string, direction: 'in' | 'out') => {
    const isIncome = direction === 'in';
    const label = type.replace('_', ' ').toUpperCase();
    return (
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
          isIncome
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            : 'bg-rose-50 text-rose-700 border border-rose-200'
        }`}
      >
        {isIncome ? <ArrowDownLeft className="w-3 h-3 text-emerald-600" /> : <ArrowUpRight className="w-3 h-3 text-rose-600" />}
        {label}
      </span>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-indigo-600" />
          <span className="truncate">{product.name}</span>
        </div>
      }
      description={`Master SKU: ${product.sku} • Category: ${product.category}`}
      maxWidth="4xl"
    >
      <div className="space-y-6">
        {/* KPI Banner & Product Header Card */}
        <div className="bg-slate-900 text-white rounded-xl p-5 shadow-sm border border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-16 h-16 rounded-lg object-cover border border-slate-700 shrink-0 bg-slate-800"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-indigo-950/80 border border-indigo-700/50 flex items-center justify-center shrink-0 text-indigo-400">
                  <Package className="w-8 h-8" />
                </div>
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-bold text-white">{product.name}</h3>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                    {product.sku}
                  </span>
                  {product.barcode && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                      <Barcode className="w-3 h-3" />
                      {product.barcode}
                    </span>
                  )}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      product.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {product.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 max-w-xl line-clamp-2">
                  {product.description || 'No description provided for this product record.'}
                </p>
              </div>
            </div>

            {onAdjustStock && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700"
                onClick={() => onAdjustStock(product)}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                Stock Adjustment
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5 pt-4 border-t border-slate-800/80">
            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Stock on Hand</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className={`text-lg font-bold font-mono ${
                    isOutOfStock
                      ? 'text-rose-400'
                      : isLowStock
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {currentStock} {product.unit}
                </span>
                {isLowStock && (
                  <span title="Low stock threshold triggered">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                  </span>
                )}
              </div>
            </div>

            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Min Safety Stock</span>
              <span className="text-lg font-bold font-mono text-slate-300 mt-1 block">
                {product.minStockAlert} {product.unit}
              </span>
            </div>

            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Cost Price (Buy)</span>
              <span className="text-lg font-bold font-mono text-slate-300 mt-1 block">
                {formatCurrency(product.costPrice, currency, currencySymbol)}
              </span>
            </div>

            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Selling Price</span>
              <span className="text-lg font-bold font-mono text-emerald-400 mt-1 block">
                {formatCurrency(product.sellingPrice, currency, currencySymbol)}
              </span>
            </div>

            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase tracking-wider block">Gross Margin</span>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-lg font-bold font-mono text-indigo-300">{marginPercent}%</span>
                <span className="text-[10px] text-slate-400">markup</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-200">
          <button
            onClick={() => setActiveTab('ledger')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'ledger'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4" />
            Stock Movements History ({ledger.length})
          </button>
          <button
            onClick={() => setActiveTab('sales')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'sales'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            Sales Orders ({productSales.length})
          </button>
          <button
            onClick={() => setActiveTab('purchases')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'purchases'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            Purchase Replenishments ({productPurchases.length})
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'details'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Info className="w-4 h-4" />
            Specification & Tax
          </button>
        </div>

        {/* Tab 1: Stock Ledger */}
        {activeTab === 'ledger' && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
              <div>
                <span className="font-semibold text-slate-800 block">Inventory Bin Card / Stock Audit Trail</span>
                <span className="text-[11px] text-slate-500">
                  Current Asset Valuation: <strong className="text-slate-800 font-mono">{formatCurrency(totalValuation, currency, currencySymbol)}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    product &&
                    printBarcodeLabels(
                      [
                        {
                          name: product.name,
                          sku: product.sku,
                          barcode: product.barcode || product.sku,
                          sellingPrice: product.sellingPrice,
                          category: product.category,
                          unit: product.unit,
                          quantity: 12,
                        },
                      ],
                      null
                    )
                  }
                  className="flex items-center gap-1.5 text-xs py-1"
                >
                  <Barcode className="w-3.5 h-3.5 text-slate-600" /> Barcodes (12)
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => product && printProductStockCard(product, ledger, null)}
                  className="flex items-center gap-1.5 text-xs py-1"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" /> Print Stock Card
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => product && printProductStockCard(product, ledger, null)}
                  className="flex items-center gap-1.5 text-xs py-1"
                >
                  <Download className="w-3.5 h-3.5 text-slate-600" /> Save PDF
                </Button>
              </div>
            </div>

            {ledger.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-lg border border-slate-200">
                <Package className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">No stock movements recorded yet</p>
                <p className="text-xs text-slate-400 mt-0.5">Physical stock movements appear automatically when transactions occur.</p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="max-h-[380px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Movement Type</th>
                        <th className="py-2.5 px-3">Reference / Order</th>
                        <th className="py-2.5 px-3 text-right">In / Out Qty</th>
                        <th className="py-2.5 px-3 text-right">Unit Cost</th>
                        <th className="py-2.5 px-3 text-right font-bold text-slate-900">Running Stock</th>
                        <th className="py-2.5 px-3">User / Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ledger.map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                            {formatDate(entry.date)}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {getTypeBadge(entry.type, entry.direction)}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-medium text-slate-800 whitespace-nowrap">
                            {entry.reference}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                            <span className={entry.direction === 'in' ? 'text-emerald-600' : 'text-rose-600'}>
                              {entry.direction === 'in' ? '+' : '-'}{entry.quantity} {product.unit}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600 whitespace-nowrap">
                            {formatCurrency(entry.cost, currency, currencySymbol)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 bg-slate-50/50 whitespace-nowrap">
                            {entry.runningStock} {product.unit}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 max-w-[200px] truncate" title={entry.notes || entry.userName}>
                            <span className="font-medium text-slate-700">{entry.userName}</span>
                            {entry.notes && <span className="block text-[11px] text-slate-400 truncate">{entry.notes}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Sales Invoices */}
        {activeTab === 'sales' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Customer sales invoices featuring this product.</span>
              <span>Total Invoices: {productSales.length}</span>
            </div>

            {productSales.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-lg border border-slate-200">
                <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">No customer sales recorded</p>
                <p className="text-xs text-slate-400 mt-0.5">Sales invoices referencing this SKU will appear here.</p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Invoice #</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3 text-right">Quantity Sold</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-right">Invoice Total</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {productSales.map((inv) => {
                      const item = inv.items.find((it) => it.productId === product.id);
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 font-mono font-medium text-indigo-600">{inv.invoiceNumber}</td>
                          <td className="py-2.5 px-3 text-slate-500">{formatDate(inv.date)}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">{inv.customerName}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                            {item?.quantity || 0} {product.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            {formatCurrency(item?.unitPrice || product.sellingPrice, currency, currencySymbol)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(inv.totalAmount, currency, currencySymbol)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                inv.paymentStatus === 'paid'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : inv.paymentStatus === 'partial'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {inv.paymentStatus.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Purchase Orders */}
        {activeTab === 'purchases' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Vendor purchase orders and replenishment shipments.</span>
              <span>Total Orders: {productPurchases.length}</span>
            </div>

            {productPurchases.length === 0 ? (
              <div className="text-center py-10 bg-slate-50 rounded-lg border border-slate-200">
                <ShoppingCart className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-600">No supplier purchases recorded</p>
                <p className="text-xs text-slate-400 mt-0.5">Purchase orders with this product will appear here.</p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">PO #</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Supplier</th>
                      <th className="py-2.5 px-3 text-right">Quantity Ordered</th>
                      <th className="py-2.5 px-3 text-right">Unit Cost</th>
                      <th className="py-2.5 px-3 text-right">Total Amount</th>
                      <th className="py-2.5 px-3 text-center">Receipt Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {productPurchases.map((po) => {
                      const item = po.items.find((it) => it.productId === product.id);
                      return (
                        <tr key={po.id} className="hover:bg-slate-50/80">
                          <td className="py-2.5 px-3 font-mono font-medium text-indigo-600">{po.poNumber}</td>
                          <td className="py-2.5 px-3 text-slate-500">{formatDate(po.date)}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">{po.supplierName}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                            {item?.quantity || 0} {product.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            {formatCurrency(item?.unitCost || product.costPrice, currency, currencySymbol)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {formatCurrency(po.totalAmount, currency, currencySymbol)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                po.receiptStatus === 'received'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {(po.receiptStatus || 'received').toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Specifications & Metadata */}
        {activeTab === 'details' && (
          <div className="bg-slate-50/70 rounded-lg p-5 border border-slate-200 space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-slate-400 font-medium block">Category</span>
                <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{product.category}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">Measurement Unit</span>
                <span className="font-semibold text-slate-800 text-sm mt-0.5 block uppercase">{product.unit}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">Statutory Tax Rate</span>
                <span className="font-semibold text-slate-800 text-sm mt-0.5 block">{product.taxRate}%</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">Maximum Storage Capacity</span>
                <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                  {product.maxStockLevel ? `${product.maxStockLevel} ${product.unit}` : 'Not Specified'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">System Creation Timestamp</span>
                <span className="font-mono text-slate-600 mt-0.5 block">{formatDate(product.createdAt)}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium block">Last Audit / Modified</span>
                <span className="font-mono text-slate-600 mt-0.5 block">{formatDate(product.updatedAt)}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200">
              <span className="text-slate-400 font-medium block">Full Technical Description & Notes</span>
              <p className="text-slate-700 mt-1 text-xs leading-relaxed bg-white p-3 rounded border border-slate-200">
                {product.description || 'No additional technical notes entered for this SKU.'}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end pt-4 border-t border-slate-100">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close Inspection
          </Button>
        </div>
      </div>
    </Modal>
  );
}

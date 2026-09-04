'use client';

import React, { useState, useEffect } from 'react';
import { Product, StockTransactionType } from '@/types/erp';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { formatCurrency } from '@/lib/utils';
import {
  SlidersHorizontal,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  Info,
  CheckCircle2,
} from 'lucide-react';

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  preselectedProduct?: Product | null;
  productStocks: Record<string, number>;
  currencySymbol: string;
  currency?: string;
  allowNegativeInventory?: boolean;
  onConfirmAdjustment: (params: {
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    direction: 'in' | 'out';
    type: StockTransactionType;
    cost: number;
    reference: string;
    notes: string;
  }) => Promise<void>;
}

export function StockAdjustmentModal({
  isOpen,
  onClose,
  products,
  preselectedProduct,
  productStocks,
  currencySymbol,
  currency = 'USD',
  allowNegativeInventory = false,
  onConfirmAdjustment,
}: StockAdjustmentModalProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [quantity, setQuantity] = useState<string>('1');
  const [cost, setCost] = useState<string>('0');
  const [reference, setReference] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const activeProds = products.filter((p) => p.status === 'active' && !p.isDeleted);
      const defaultProd = preselectedProduct || (activeProds.length > 0 ? activeProds[0] : null);
      if (defaultProd) {
        setSelectedProductId(defaultProd.id);
        setCost(String(defaultProd.costPrice || 0));
      }
      setDirection('in');
      setQuantity('1');
      setReference(`ADJ-${Math.floor(10000 + Math.random() * 90000)}`);
      setReason('');
      setErrorMsg(null);
    }
  }, [isOpen, preselectedProduct, products]);

  const activeProduct = products.find((p) => p.id === selectedProductId);
  const currentStock = activeProduct ? (productStocks[activeProduct.id] ?? activeProduct.currentStock ?? 0) : 0;
  const numQty = parseFloat(quantity) || 0;
  const numCost = parseFloat(cost) || 0;

  const resultingStock = direction === 'in' ? currentStock + numQty : currentStock - numQty;
  const wouldBeNegative = resultingStock < 0;
  const isBlockedByNegativeRule = wouldBeNegative && !allowNegativeInventory;

  const handleProductChange = (prodId: string) => {
    setSelectedProductId(prodId);
    const p = products.find((item) => item.id === prodId);
    if (p) {
      setCost(String(p.costPrice || 0));
    }
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProduct) {
      setErrorMsg('Please select a valid product.');
      return;
    }
    if (numQty <= 0) {
      setErrorMsg('Adjustment quantity must be greater than zero.');
      return;
    }
    if (numCost < 0) {
      setErrorMsg('Unit cost cannot be negative.');
      return;
    }
    if (isBlockedByNegativeRule) {
      setErrorMsg(
        `Negative inventory is prohibited. Deducting ${numQty} would result in ${resultingStock} on hand.`
      );
      return;
    }
    if (!reason.trim()) {
      setErrorMsg('Please state a reason or physical audit note for this adjustment.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onConfirmAdjustment({
        productId: activeProduct.id,
        productName: activeProduct.name,
        sku: activeProduct.sku,
        quantity: numQty,
        direction,
        type: direction === 'in' ? 'adjustment_in' : 'adjustment_out',
        cost: numCost,
        reference: reference.trim() || `ADJ-${Date.now().toString().slice(-5)}`,
        notes: reason.trim(),
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to record stock adjustment.';
      setErrorMsg(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-5 h-5 text-indigo-600" />
          <span>Record Stock Adjustment</span>
        </div>
      }
      description="Create an immutable physical count or warehouse reconciliation transaction."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Validation Guardrail</p>
              <p className="mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        <div>
          <Select
            label="Product SKU"
            value={selectedProductId}
            onChange={(e) => handleProductChange(e.target.value)}
            options={products
              .filter((p) => !p.isDeleted)
              .map((p) => ({
                value: p.id,
                label: `${p.name} (${p.sku}) — Current: ${productStocks[p.id] ?? p.currentStock ?? 0} ${p.unit}`,
              }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setDirection('in')}
            className={`p-3 rounded-lg border text-left transition-all flex items-center justify-between ${
              direction === 'in'
                ? 'border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-900">Stock In (+)</span>
                <span className="text-[11px] text-slate-500">Found, surplus, count gain</span>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setDirection('out')}
            className={`p-3 rounded-lg border text-left transition-all flex items-center justify-between ${
              direction === 'out'
                ? 'border-rose-500 bg-rose-50/50 ring-2 ring-rose-500/20'
                : 'border-slate-200 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-900">Stock Out (-)</span>
                <span className="text-[11px] text-slate-500">Damaged, write-off, loss</span>
              </div>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label={`Adjustment Quantity (${activeProduct?.unit || 'units'})`}
            type="number"
            step="1"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
          <Input
            label={`Valuation Unit Cost (${currencySymbol})`}
            type="number"
            step="0.01"
            min="0"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            required
          />
          <Input
            label="Adjustment Reference #"
            placeholder="e.g. ADJ-5001"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            required
          />
        </div>

        {/* Live Calculation Preview Card */}
        {activeProduct && (
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-600">
              <span>Current Stock on Hand:</span>
              <span className="font-mono font-bold text-slate-900">
                {currentStock} {activeProduct.unit}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span>Transaction Movement:</span>
              <span
                className={`font-mono font-bold ${
                  direction === 'in' ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {direction === 'in' ? '+' : '-'}{numQty} {activeProduct.unit}
              </span>
            </div>
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
              <span className="font-semibold text-slate-900">Resulting Stock on Hand:</span>
              <span
                className={`font-mono font-bold text-sm ${
                  resultingStock < 0
                    ? 'text-rose-600'
                    : resultingStock <= activeProduct.minStockAlert
                    ? 'text-amber-600'
                    : 'text-emerald-600'
                }`}
              >
                {resultingStock} {activeProduct.unit}
              </span>
            </div>
            {isBlockedByNegativeRule && (
              <p className="text-[11px] text-rose-600 flex items-center gap-1 pt-1 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                Negative inventory is disabled by policy. This deduction cannot be processed.
              </p>
            )}
          </div>
        )}

        <Input
          label="Adjustment Reason / Audit Note"
          placeholder="e.g. Annual physical cycle count correction, scrap write-off..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
        />

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={submitting} disabled={isBlockedByNegativeRule || numQty <= 0}>
            Commit Stock Adjustment
          </Button>
        </div>
      </form>
    </Modal>
  );
}

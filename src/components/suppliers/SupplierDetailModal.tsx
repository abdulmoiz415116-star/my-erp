'use client';

import React, { useState, useMemo } from 'react';
import { Supplier, PurchaseOrder, Payment } from '@/types/erp';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatDate } from '@/lib/utils';
import { generateSupplierLedger } from '@/services/erp.service';
import { printSupplierStatement } from '@/lib/pdfPrint';
import {
  Building,
  Mail,
  Phone,
  MapPin,
  Plus,
  Printer,
  Download,
} from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';

interface SupplierDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier | null;
  currencySymbol: string;
  currencyCode: string;
  purchases: PurchaseOrder[];
  payments: Payment[];
  onAddPayment?: (supplier: Supplier) => void;
}

type TabType = 'overview' | 'purchases' | 'payments' | 'ledger';

export function SupplierDetailModal({
  isOpen,
  onClose,
  supplier,
  currencySymbol,
  currencyCode,
  purchases,
  payments,
  onAddPayment,
}: SupplierDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const supplierPurchases = useMemo(() => {
    if (!supplier) return [];
    return purchases
      .filter((p) => p.supplierId === supplier.id && !p.isDeleted)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [supplier, purchases]);

  const supplierPayments = useMemo(() => {
    if (!supplier) return [];
    return payments
      .filter((p) => p.partyId === supplier.id && p.partyType === 'supplier' && !p.isDeleted)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [supplier, payments]);

  const ledgerEntries = useMemo(() => {
    if (!supplier) return [];
    return generateSupplierLedger(supplier, purchases, payments);
  }, [supplier, purchases, payments]);

  if (!supplier) return null;

  // Real-time calculated balance from valid transactions (Opening + Purchases - Disbursements)
  const openingBalance = supplier.openingBalance || 0;
  const totalPurchased = supplierPurchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
  const totalDisbursed = supplierPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const calculatedBalance = openingBalance + totalPurchased - totalDisbursed;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${supplier.name} (${supplier.code})`}
      description="Supplier Master Record, Orders History, and Running Accounts Payable Statement"
      maxWidth="3xl"
    >
      <div className="space-y-5">
        {/* Header Summary Card */}
        <div className="p-4 rounded-xl bg-slate-900 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">{supplier.name}</h3>
              <StatusBadge status={supplier.status} />
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              {supplier.companyName ? `${supplier.companyName} • ` : ''}Registered {formatDate(supplier.createdAt)}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[10px] uppercase font-mono text-slate-400 block font-bold">Outstanding Payable</span>
              <span className={`text-xl font-bold font-mono ${calculatedBalance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {formatCurrency(calculatedBalance, currencyCode, currencySymbol)}
              </span>
            </div>
            {onAddPayment && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  onClose();
                  onAddPayment(supplier);
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                Make Payment
              </Button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'overview'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Overview & Terms
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('purchases')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'purchases'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span>Purchase Orders</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-mono">
              {supplierPurchases.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'payments'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span>Payments Made</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-mono">
              {supplierPayments.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ledger')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'ledger'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span>Statement / Ledger</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-mono">
              {ledgerEntries.length}
            </span>
          </button>
        </div>

        {/* TAB 1: Overview & Profile */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70">
                <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Opening Balance</span>
                <span className="text-sm font-bold font-mono text-slate-900 mt-0.5 block">
                  {formatCurrency(openingBalance, currencyCode, currencySymbol)}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70">
                <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Payment Terms</span>
                <span className="text-sm font-bold font-mono text-slate-900 mt-0.5 block">
                  Net {supplier.paymentTermsDays || 30} Days
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70">
                <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Credit Limit</span>
                <span className="text-sm font-bold font-mono text-slate-900 mt-0.5 block">
                  {formatCurrency(supplier.creditLimit || 0, currencyCode, currencySymbol)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Contact Information */}
              <div className="p-4 rounded-lg border border-slate-200 space-y-2.5">
                <h4 className="font-bold text-slate-900 uppercase font-mono text-[11px] tracking-wider">
                  Vendor & Billing Contact
                </h4>
                <div className="space-y-1.5 text-slate-600">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{supplier.email || 'No email provided'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{supplier.phone || 'No phone provided'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Tax ID: {supplier.taxNumber || 'None / Exempt'}</span>
                  </div>
                </div>
              </div>

              {/* Physical Address */}
              <div className="p-4 rounded-lg border border-slate-200 space-y-2.5">
                <h4 className="font-bold text-slate-900 uppercase font-mono text-[11px] tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  Dispatch / Warehousing Address
                </h4>
                <div className="text-slate-600 space-y-0.5 text-xs">
                  <p>{supplier.address?.street || 'No street specified'}</p>
                  <p>
                    {[supplier.address?.city, supplier.address?.state, supplier.address?.postalCode]
                      .filter(Boolean)
                      .join(', ') || 'No city/state'}
                  </p>
                  <p className="font-semibold text-slate-700">{supplier.address?.country || 'USA'}</p>
                </div>
              </div>
            </div>

            {/* Notes */}
            {supplier.notes && (
              <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-200/60 text-xs text-blue-900">
                <span className="font-bold block mb-0.5">Supplier Notes & Agreement:</span>
                <p className="leading-relaxed">{supplier.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Purchase Orders History */}
        {activeTab === 'purchases' && (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase font-mono">
                  <th className="py-2.5 px-3">PO Number</th>
                  <th className="py-2.5 px-3">Order Date</th>
                  <th className="py-2.5 px-3 text-right">Total Amount</th>
                  <th className="py-2.5 px-3 text-right">Balance Owed</th>
                  <th className="py-2.5 px-3 text-center">Receipt Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {supplierPurchases.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{p.poNumber}</td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono">{formatDate(p.date)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(p.totalAmount, currencyCode, currencySymbol)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-rose-600 font-bold">
                      {formatCurrency(p.balanceAmount, currencyCode, currencySymbol)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase bg-slate-100 text-slate-700">
                        {p.receiptStatus}
                      </span>
                    </td>
                  </tr>
                ))}
                {supplierPurchases.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                      No purchase orders recorded for this supplier yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: Payments Made */}
        {activeTab === 'payments' && (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase font-mono">
                  <th className="py-2.5 px-3">Payment #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Account & Method</th>
                  <th className="py-2.5 px-3">Reference</th>
                  <th className="py-2.5 px-3 text-right">Amount Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {supplierPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{p.paymentNumber}</td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono">{formatDate(p.date)}</td>
                    <td className="py-2.5 px-3 text-slate-700">
                      <span className="capitalize">{p.paymentMethod.replace('_', ' ')}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">{p.accountName}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">{p.reference || '—'}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-600">
                      {formatCurrency(p.amount, currencyCode, currencySymbol)}
                    </td>
                  </tr>
                ))}
                {supplierPayments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                      No payments disbursed to this supplier yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: Statement / Ledger */}
        {activeTab === 'ledger' && (
          <div className="space-y-3">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="block font-semibold text-slate-800">Supplier Account Statement</span>
                <span className="text-[11px] text-slate-500">
                  Total Payable: <strong className="text-amber-700 font-mono">{formatCurrency(calculatedBalance, currencyCode, currencySymbol)}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => supplier && printSupplierStatement(supplier, ledgerEntries, null)}
                  className="flex items-center gap-1.5 text-xs py-1"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" /> Print Statement
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => supplier && printSupplierStatement(supplier, ledgerEntries, null)}
                  className="flex items-center gap-1.5 text-xs py-1 bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                >
                  <Download className="w-3.5 h-3.5" /> Save PDF
                </Button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-[350px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase font-mono sticky top-0">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Ref</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-right">Debit (-) Paid</th>
                    <th className="py-2.5 px-3 text-right">Credit (+) Owed</th>
                    <th className="py-2.5 px-3 text-right font-bold">Payable Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {ledgerEntries.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/70 text-xs">
                      <td className="py-2 px-3 text-slate-500 whitespace-nowrap">{formatDate(e.date)}</td>
                      <td className="py-2 px-3 font-bold text-slate-800">{e.reference}</td>
                      <td className="py-2 px-3 font-sans text-slate-700">{e.description}</td>
                      <td className="py-2 px-3 text-right text-blue-600">
                        {e.debit > 0 ? formatCurrency(e.debit, currencyCode, currencySymbol) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-900">
                        {e.credit > 0 ? formatCurrency(e.credit, currencyCode, currencySymbol) : '—'}
                      </td>
                      <td className={`py-2 px-3 text-right font-bold ${e.runningBalance > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                        {formatCurrency(e.runningBalance, currencyCode, currencySymbol)}
                      </td>
                    </tr>
                  ))}
                  {ledgerEntries.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-slate-400 font-sans">
                        No transactions registered on supplier statement.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
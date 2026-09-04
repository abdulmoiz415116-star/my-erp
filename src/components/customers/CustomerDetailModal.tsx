'use client';

import React, { useState, useMemo } from 'react';
import { Customer, SaleInvoice, Payment } from '@/types/erp';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { formatCurrency, formatDate } from '@/lib/utils';
import { generateCustomerLedger } from '@/services/erp.service';
import { printCustomerStatement } from '@/lib/pdfPrint';
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

interface CustomerDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  currencySymbol: string;
  currencyCode: string;
  sales: SaleInvoice[];
  payments: Payment[];
  onAddPayment?: (customer: Customer) => void;
}

type TabType = 'overview' | 'sales' | 'payments' | 'ledger';

export function CustomerDetailModal({
  isOpen,
  onClose,
  customer,
  currencySymbol,
  currencyCode,
  sales,
  payments,
  onAddPayment,
}: CustomerDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const customerSales = useMemo(() => {
    if (!customer) return [];
    return sales
      .filter((s) => s.customerId === customer.id && !s.isDeleted)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [customer, sales]);

  const customerPayments = useMemo(() => {
    if (!customer) return [];
    return payments
      .filter((p) => p.partyId === customer.id && p.partyType === 'customer' && !p.isDeleted)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [customer, payments]);

  const ledgerEntries = useMemo(() => {
    if (!customer) return [];
    return generateCustomerLedger(customer, sales, payments);
  }, [customer, sales, payments]);

  if (!customer) return null;

  // Real-time calculated balance from valid transactions (Opening + Invoices - Receipts)
  const openingBalance = customer.openingBalance || 0;
  const totalInvoiced = customerSales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  const totalReceived = customerPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const calculatedBalance = openingBalance + totalInvoiced - totalReceived;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${customer.name} (${customer.code})`}
      description="Customer Master Record, Transaction History, and Running Statement"
      maxWidth="3xl"
    >
      <div className="space-y-5">
        {/* Header Summary Card */}
        <div className="p-4 rounded-xl bg-slate-900 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">{customer.name}</h3>
              <StatusBadge status={customer.status} />
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              {customer.companyName ? `${customer.companyName} • ` : ''}Registered {formatDate(customer.createdAt)}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[10px] uppercase font-mono text-slate-400 block font-bold">Outstanding Balance</span>
              <span className={`text-xl font-bold font-mono ${calculatedBalance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {formatCurrency(calculatedBalance, currencyCode, currencySymbol)}
              </span>
            </div>
            {onAddPayment && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  onClose();
                  onAddPayment(customer);
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                Receive Payment
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
            Overview & Profile
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sales')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'sales'
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <span>Sales Invoices</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-mono">
              {customerSales.length}
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
            <span>Payment Receipts</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 font-mono">
              {customerPayments.length}
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
                <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Credit Limit</span>
                <span className="text-sm font-bold font-mono text-slate-900 mt-0.5 block">
                  {formatCurrency(customer.creditLimit || 0, currencyCode, currencySymbol)}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/70">
                <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block">Credit Availability</span>
                <span className="text-sm font-bold font-mono text-emerald-600 mt-0.5 block">
                  {formatCurrency(Math.max(0, (customer.creditLimit || 0) - calculatedBalance), currencyCode, currencySymbol)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Contact Information */}
              <div className="p-4 rounded-lg border border-slate-200 space-y-2.5">
                <h4 className="font-bold text-slate-900 uppercase font-mono text-[11px] tracking-wider">
                  Contact Information
                </h4>
                <div className="space-y-1.5 text-slate-600">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{customer.email || 'No email provided'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{customer.phone || 'No phone provided'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Tax Registration: {customer.taxNumber || 'None / Exempt'}</span>
                  </div>
                </div>
              </div>

              {/* Invoicing Address */}
              <div className="p-4 rounded-lg border border-slate-200 space-y-2.5">
                <h4 className="font-bold text-slate-900 uppercase font-mono text-[11px] tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  Invoicing / Billing Address
                </h4>
                <div className="text-slate-600 space-y-0.5 text-xs">
                  <p>{customer.address?.street || 'No street specified'}</p>
                  <p>
                    {[customer.address?.city, customer.address?.state, customer.address?.postalCode]
                      .filter(Boolean)
                      .join(', ') || 'No city/state'}
                  </p>
                  <p className="font-semibold text-slate-700">{customer.address?.country || 'USA'}</p>
                </div>
              </div>
            </div>

            {/* Notes */}
            {customer.notes && (
              <div className="p-3 rounded-lg bg-amber-50/50 border border-amber-200/60 text-xs text-amber-900">
                <span className="font-bold block mb-0.5">Customer Notes & Terms:</span>
                <p className="leading-relaxed">{customer.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Sales Invoices History */}
        {activeTab === 'sales' && (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase font-mono">
                  <th className="py-2.5 px-3">Invoice #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3 text-right">Total Amount</th>
                  <th className="py-2.5 px-3 text-right">Balance</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customerSales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{s.invoiceNumber}</td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono">{formatDate(s.date)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(s.totalAmount, currencyCode, currencySymbol)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-amber-600">
                      {formatCurrency(s.balanceAmount, currencyCode, currencySymbol)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase ${
                        s.paymentStatus === 'paid' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        {s.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
                {customerSales.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                      No sales invoices recorded for this customer yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: Payment Receipts */}
        {activeTab === 'payments' && (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase font-mono">
                  <th className="py-2.5 px-3">Receipt #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Method & Account</th>
                  <th className="py-2.5 px-3">Reference</th>
                  <th className="py-2.5 px-3 text-right">Amount Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customerPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{p.paymentNumber}</td>
                    <td className="py-2.5 px-3 text-slate-500 font-mono">{formatDate(p.date)}</td>
                    <td className="py-2.5 px-3 text-slate-700">
                      <span className="capitalize">{p.paymentMethod.replace('_', ' ')}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">{p.accountName}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">{p.reference || '—'}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">
                      {formatCurrency(p.amount, currencyCode, currencySymbol)}
                    </td>
                  </tr>
                ))}
                {customerPayments.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                      No payments recorded for this customer yet.
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
                <span className="block font-semibold text-slate-800">Account Ledger Statement</span>
                <span className="text-[11px] text-slate-500">
                  Balance Due: <strong className="text-rose-600 font-mono">{formatCurrency(calculatedBalance, currencyCode, currencySymbol)}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => customer && printCustomerStatement(customer, ledgerEntries, null)}
                  className="flex items-center gap-1.5 text-xs py-1"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" /> Print Statement
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => customer && printCustomerStatement(customer, ledgerEntries, null)}
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
                    <th className="py-2.5 px-3 text-right">Debit (+)</th>
                    <th className="py-2.5 px-3 text-right">Credit (-)</th>
                    <th className="py-2.5 px-3 text-right font-bold">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {ledgerEntries.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/70 text-xs">
                      <td className="py-2 px-3 text-slate-500 whitespace-nowrap">{formatDate(e.date)}</td>
                      <td className="py-2 px-3 font-bold text-slate-800">{e.reference}</td>
                      <td className="py-2 px-3 font-sans text-slate-700">{e.description}</td>
                      <td className="py-2 px-3 text-right text-slate-900">
                        {e.debit > 0 ? formatCurrency(e.debit, currencyCode, currencySymbol) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right text-emerald-600">
                        {e.credit > 0 ? formatCurrency(e.credit, currencyCode, currencySymbol) : '—'}
                      </td>
                      <td className={`py-2 px-3 text-right font-bold ${e.runningBalance > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                        {formatCurrency(e.runningBalance, currencyCode, currencySymbol)}
                      </td>
                    </tr>
                  ))}
                  {ledgerEntries.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-slate-400 font-sans">
                        No transactions registered on customer statement.
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
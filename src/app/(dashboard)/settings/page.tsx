'use client';

import React, { useState, useEffect } from 'react';
import { useTenant } from '@/context/TenantContext';
import { PageHeader } from '@/components/common/PageHeader';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/context/ToastContext';
import { TenantService } from '@/services/tenant.service';
import {
  Building2,
  Save,
  CheckCircle2,
  DollarSign,
  FileText,
  Calendar,
  Sliders,
  ShieldCheck,
  AlertCircle,
  MapPin,
  RefreshCw,
  Bell,
  Users,
  Building,
} from 'lucide-react';

export default function SettingsPage() {
  const { currentTenant, updateCurrentTenant, refreshTenants } = useTenant();
  const { showToast } = useToast();

  const [saving, setSaving] = useState(false);

  // Identity & Contact
  const [name, setName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('');

  // Financial & Tax
  const [currency, setCurrency] = useState('USD');
  const [currencySymbol, setCurrencySymbol] = useState('$');
  const [taxName, setTaxName] = useState('VAT');
  const [defaultTaxRate, setDefaultTaxRate] = useState(15.0);
  const [taxNumber, setTaxNumber] = useState('');

  // Invoice & Sequence Numbers
  const [invoicePrefix, setInvoicePrefix] = useState('INV-');
  const [invoiceNextNumber, setInvoiceNextNumber] = useState(1001);
  const [purchaseOrderPrefix, setPurchaseOrderPrefix] = useState('PO-');
  const [purchaseOrderNextNumber, setPurchaseOrderNextNumber] = useState(1001);
  const [enableAutoInvoiceNumbering, setEnableAutoInvoiceNumbering] = useState(true);

  // Regional & Fiscal
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState(1);
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD');
  const [timezone, setTimezone] = useState('UTC');

  // Operational Guardrails & Notification Alerts
  const [enableRealtimeSync, setEnableRealtimeSync] = useState(true);
  const [allowNegativeInventory, setAllowNegativeInventory] = useState(false);
  const [enableLowStockAlerts, setEnableLowStockAlerts] = useState(true);
  const [enableCustomerOverdueAlerts, setEnableCustomerOverdueAlerts] = useState(true);
  const [enableSupplierPayableAlerts, setEnableSupplierPayableAlerts] = useState(true);
  const [enableSystemEventAlerts, setEnableSystemEventAlerts] = useState(true);

  // Hydrate state from current tenant
  useEffect(() => {
    if (currentTenant) {
      setName(currentTenant.name || '');
      setLegalName(currentTenant.legalName || currentTenant.name || '');
      setLogoUrl(currentTenant.logoUrl || '');
      setEmail(currentTenant.email || '');
      setPhone(currentTenant.phone || '');

      setStreet(currentTenant.address?.street || '');
      setCity(currentTenant.address?.city || '');
      setState(currentTenant.address?.state || '');
      setPostalCode(currentTenant.address?.postalCode || '');
      setCountry(currentTenant.address?.country || '');

      setCurrency(currentTenant.settings.currency || 'USD');
      setCurrencySymbol(currentTenant.settings.currencySymbol || '$');
      setTaxName(currentTenant.settings.taxName || 'VAT');
      setDefaultTaxRate(currentTenant.settings.defaultTaxRate !== undefined ? currentTenant.settings.defaultTaxRate : 15.0);
      setTaxNumber(currentTenant.settings.taxNumber || '');

      setInvoicePrefix(currentTenant.settings.invoicePrefix || 'INV-');
      setInvoiceNextNumber(currentTenant.settings.invoiceNextNumber || 1001);
      setPurchaseOrderPrefix(currentTenant.settings.purchaseOrderPrefix || 'PO-');
      setPurchaseOrderNextNumber(currentTenant.settings.purchaseOrderNextNumber || 1001);
      setEnableAutoInvoiceNumbering(currentTenant.settings.enableAutoInvoiceNumbering !== false);

      setFiscalYearStartMonth(currentTenant.settings.fiscalYearStartMonth || 1);
      setDateFormat(currentTenant.settings.dateFormat || 'YYYY-MM-DD');
      setTimezone(currentTenant.settings.timezone || 'UTC');

      setEnableRealtimeSync(currentTenant.settings.enableRealtimeSync !== false);
      setAllowNegativeInventory(Boolean(currentTenant.settings.allowNegativeInventory));
      setEnableLowStockAlerts(currentTenant.settings.enableLowStockAlerts !== false);
      setEnableCustomerOverdueAlerts(currentTenant.settings.enableCustomerOverdueAlerts !== false);
      setEnableSupplierPayableAlerts(currentTenant.settings.enableSupplierPayableAlerts !== false);
      setEnableSystemEventAlerts(currentTenant.settings.enableSystemEventAlerts !== false);
    }
  }, [currentTenant]);

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTenant) return;

    setSaving(true);
    try {
      const updatedTenant = await TenantService.updateTenant(currentTenant.id, {
        name,
        legalName,
        logoUrl,
        email,
        phone,
        address: {
          street,
          city,
          state,
          postalCode,
          country,
        },
        settings: {
          currency,
          currencySymbol,
          taxName,
          defaultTaxRate: Number(defaultTaxRate),
          taxNumber,
          invoicePrefix,
          invoiceNextNumber: Number(invoiceNextNumber),
          purchaseOrderPrefix,
          purchaseOrderNextNumber: Number(purchaseOrderNextNumber),
          enableAutoInvoiceNumbering,
          fiscalYearStartMonth: Number(fiscalYearStartMonth),
          dateFormat,
          timezone,
          enableRealtimeSync,
          allowNegativeInventory,
          enableLowStockAlerts,
          enableCustomerOverdueAlerts,
          enableSupplierPayableAlerts,
          enableSystemEventAlerts,
        },
      });

      updateCurrentTenant(updatedTenant);
      showToast('Business settings successfully saved & synchronized', 'success');
    } catch (err) {
      console.error('Failed to save settings:', err);
      showToast('Failed to update business configuration', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCurrencyChange = (val: string) => {
    setCurrency(val);
    const symbols: Record<string, string> = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      CAD: '$',
      AUD: '$',
      AED: 'د.إ',
      SAR: '﷼',
      INR: '₹',
      JPY: '¥',
    };
    setCurrencySymbol(symbols[val] || '$');
  };

  return (
    <div className="space-y-6 max-w-5xl pb-16">
      <PageHeader
        title="Business Settings & Preferences"
        subtitle={`Configure legal identity, branding, taxation, numbering sequences, and controls for ${currentTenant?.name || 'Workspace'}`}
      />

      <form onSubmit={handleSaveAll} className="space-y-6">
        {/* SECTION 1: Workspace Tenant Identity Status */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Workspace Database Partition</h3>
                <p className="text-xs text-slate-500">Multi-tenant isolation and tenancy identifiers</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Live Multi-Tenant Partition Active
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block">Tenant ID</span>
              <span className="font-mono font-bold text-slate-800 text-xs mt-0.5 block truncate">
                {currentTenant?.id}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block">Company Code</span>
              <span className="font-mono font-bold text-slate-800 text-sm mt-0.5 block">
                {currentTenant?.code}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
              <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block">Created Timestamp</span>
              <span className="font-mono text-slate-700 text-xs mt-0.5 block">
                {currentTenant?.createdAt ? new Date(currentTenant.createdAt).toLocaleDateString() : 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 2: Company Details & Branding */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Company Identity & Legal Details</h3>
              <p className="text-xs text-slate-500">Official business information appearing on generated invoices, orders, and receipts</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Business / Trading Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Global Corporation"
              required
            />
            <Input
              label="Legal Registered Name"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="Acme Global Solutions Inc."
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Official Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@acmeglobal.com"
              required
            />
            <Input
              label="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (555) 234-5678"
            />
            <Input
              label="Logo Image URL"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
            />
          </div>

          {/* Business Address */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              Physical / Invoicing Address
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-3">
                <Input
                  label="Street Address"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="100 Tech Blvd, Suite 400"
                />
              </div>
              <Input
                label="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="San Francisco"
              />
              <Input
                label="State / Province"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="CA"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Postal Code"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="94105"
                />
                <Input
                  label="Country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="USA"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: Financial, Currency & Tax Settings */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Currency & Tax Configuration</h3>
              <p className="text-xs text-slate-500">Default monetary parameters, sales taxes, and statutory registration numbers</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Base Reporting Currency"
              value={currency}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              options={[
                { value: 'USD', label: 'USD - US Dollar ($)' },
                { value: 'EUR', label: 'EUR - Euro (€)' },
                { value: 'GBP', label: 'GBP - British Pound (£)' },
                { value: 'CAD', label: 'CAD - Canadian Dollar ($)' },
                { value: 'AUD', label: 'AUD - Australian Dollar ($)' },
                { value: 'AED', label: 'AED - UAE Dirham (د.إ)' },
                { value: 'SAR', label: 'SAR - Saudi Riyal (﷼)' },
                { value: 'INR', label: 'INR - Indian Rupee (₹)' },
              ]}
            />
            <Input
              label="Currency Symbol"
              value={currencySymbol}
              onChange={(e) => setCurrencySymbol(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Tax System Label"
              value={taxName}
              onChange={(e) => setTaxName(e.target.value)}
              placeholder="VAT / GST / Sales Tax"
              required
            />
            <Input
              label="Default Tax Rate (%)"
              type="number"
              step="0.1"
              value={defaultTaxRate}
              onChange={(e) => setDefaultTaxRate(parseFloat(e.target.value) || 0)}
              required
            />
            <Input
              label="Tax ID / VAT Registration #"
              value={taxNumber}
              onChange={(e) => setTaxNumber(e.target.value)}
              placeholder="e.g. US-987654321"
            />
          </div>
        </div>

        {/* SECTION 4: Invoicing & Document Sequences */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Document Numbering & Sequences</h3>
              <p className="text-xs text-slate-500">Configure auto-incrementing serial numbers and custom prefixes for sales and purchases</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-slate-50/60 border border-slate-200/80 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                Sales Invoices
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Invoice Prefix"
                  value={invoicePrefix}
                  onChange={(e) => setInvoicePrefix(e.target.value)}
                  placeholder="INV-"
                  required
                />
                <Input
                  label="Next Sequence #"
                  type="number"
                  value={invoiceNextNumber}
                  onChange={(e) => setInvoiceNextNumber(parseInt(e.target.value, 10) || 1)}
                  required
                />
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                Next generated code: <span className="font-bold text-slate-900">{invoicePrefix}{invoiceNextNumber}</span>
              </p>
            </div>

            <div className="p-4 rounded-lg bg-slate-50/60 border border-slate-200/80 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
                Purchase Orders
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="PO Prefix"
                  value={purchaseOrderPrefix}
                  onChange={(e) => setPurchaseOrderPrefix(e.target.value)}
                  placeholder="PO-"
                  required
                />
                <Input
                  label="Next Sequence #"
                  type="number"
                  value={purchaseOrderNextNumber}
                  onChange={(e) => setPurchaseOrderNextNumber(parseInt(e.target.value, 10) || 1)}
                  required
                />
              </div>
              <p className="text-[11px] text-slate-500 font-mono">
                Next generated code: <span className="font-bold text-slate-900">{purchaseOrderPrefix}{purchaseOrderNextNumber}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
            <div>
              <p className="text-xs font-bold text-slate-800">Auto-Increment Sequence Numbering</p>
              <p className="text-[11px] text-slate-500">Automatically advance document sequence counter upon invoice creation</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enableAutoInvoiceNumbering}
                onChange={(e) => setEnableAutoInvoiceNumbering(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>

        {/* SECTION 5: Regional & Fiscal Year Preferences */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Fiscal Calendar & Regional Formats</h3>
              <p className="text-xs text-slate-500">Accounting periods, timezones, and localized calendar views</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select
              label="Fiscal Year Start Month"
              value={fiscalYearStartMonth.toString()}
              onChange={(e) => setFiscalYearStartMonth(parseInt(e.target.value, 10))}
              options={[
                { value: '1', label: 'January (Calendar Year)' },
                { value: '4', label: 'April (e.g. UK / India)' },
                { value: '7', label: 'July (e.g. Australia)' },
                { value: '10', label: 'October (e.g. US Federal)' },
              ]}
            />

            <Select
              label="Date Display Format"
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
              options={[
                { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (e.g. 2026-09-04)' },
                { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (e.g. 04/09/2026)' },
                { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (e.g. 09/04/2026)' },
              ]}
            />

            <Select
              label="Workspace Timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              options={[
                { value: 'UTC', label: 'UTC (Universal Coordinated Time)' },
                { value: 'America/New_York', label: 'America/New York (EST)' },
                { value: 'America/Chicago', label: 'America/Chicago (CST)' },
                { value: 'America/Los_Angeles', label: 'America/Los Angeles (PST)' },
                { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
                { value: 'Europe/Paris', label: 'Europe/Paris (CET)' },
                { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
                { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
              ]}
            />
          </div>
        </div>

        {/* SECTION 6: Operational Guardrails & Feature Toggles */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">System Preferences & Operational Guardrails</h3>
              <p className="text-xs text-slate-500">Enable or disable ERP features and inventory safeguards</p>
            </div>
          </div>

          <div className="space-y-3 pt-1">
            {/* Real-time Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200">
              <div>
                <p className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                  Real-Time Synchronization Stream
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Maintain continuous bi-directional reactive listeners for sales, expenses, and inventory across all browser sessions.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableRealtimeSync}
                  onChange={(e) => setEnableRealtimeSync(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Negative Inventory Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200">
              <div>
                <p className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Block Negative Physical Inventory
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Disallow sales dispatch and fulfillments if available on-hand stock is lower than requested order quantities.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={!allowNegativeInventory}
                  onChange={(e) => setAllowNegativeInventory(!e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Low Stock Alerts Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200">
              <div>
                <p className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  Enable Low Stock Warning Alerts
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Display real-time notification alerts when on-hand stock drops to or below the minimum reorder threshold.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableLowStockAlerts}
                  onChange={(e) => setEnableLowStockAlerts(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Customer Overdue Alerts Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200">
              <div>
                <p className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-rose-600" />
                  Enable Customer Outstanding & Overdue Alerts
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Trigger notifications for customer receivables that exceed agreed credit limits or pending overdue balances.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableCustomerOverdueAlerts}
                  onChange={(e) => setEnableCustomerOverdueAlerts(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* Supplier Payable Alerts Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200">
              <div>
                <p className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <Building className="w-3.5 h-3.5 text-blue-600" />
                  Enable Supplier Trade Payable Reminders
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Send notification reminders when vendor purchase balances become due for disbursement.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableSupplierPayableAlerts}
                  onChange={(e) => setEnableSupplierPayableAlerts(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* System Events & Reversal Alerts Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-lg border border-slate-200">
              <div>
                <p className="text-xs font-bold text-slate-800 flex items-center gap-2">
                  <Bell className="w-3.5 h-3.5 text-indigo-600" />
                  Enable System Audit & Reversal Notifications
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Notify administrators when vouchers are reversed, transactions are voided, or major system events occur.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enableSystemEventAlerts}
                  onChange={(e) => setEnableSystemEventAlerts(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="sticky bottom-4 z-10 bg-white/95 backdrop-blur-md rounded-xl border border-slate-200 p-4 shadow-lg flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Changes will apply immediately across all authorized users and ledger modules.</span>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => refreshTenants()}
            >
              Reset to Saved
            </Button>
            <Button type="submit" loading={saving}>
              <Save className="w-4 h-4" />
              Save Settings
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

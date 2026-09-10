'use client';

import React, { useState } from 'react';
import { useTenant } from '@/context/TenantContext';
import { Building2, ChevronDown, Plus, Check, Globe } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';

export function TenantSwitcher() {
  const { currentTenant, tenants, switchTenant, createTenant } = useTenant();
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // New tenant form state
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [phone, setPhone] = useState('');

  const handleCreateNewTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code || !email) return;

    setSubmitting(true);
    try {
      await createTenant({ name, code, email, currency, phone });
      setIsModalOpen(false);
      setName('');
      setCode('');
      setEmail('');
      setPhone('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-all text-left shadow-2xs group"
        >
          <div className="w-7 h-7 rounded-md bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="max-w-[140px] sm:max-w-[180px] truncate">
            <div className="text-xs font-bold text-slate-900 truncate">
              {currentTenant ? currentTenant.name : 'Select Company'}
            </div>
            <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
              <span>{currentTenant?.code || 'NO-TENANT'}</span>
              <span className="text-slate-300">•</span>
              <span>{currentTenant?.settings.currency || 'USD'}</span>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-transform ml-1" />
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setIsOpen(false)} />
            <div className="absolute left-0 mt-2 w-72 rounded-xl bg-white shadow-xl border border-slate-200 z-30 p-2 animate-in fade-in zoom-in-95">
              <div className="px-2 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Select Company Workspace
              </div>

              <div className="max-h-56 overflow-y-auto space-y-1 my-1">
                {tenants.map((tenant) => {
                  const isSelected = tenant.id === currentTenant?.id;
                  return (
                    <button
                      key={tenant.id}
                      onClick={() => {
                        switchTenant(tenant.id);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors ${
                        isSelected
                          ? 'bg-indigo-50 text-indigo-900 font-semibold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div
                          className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold ${
                            isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {tenant.code.slice(0, 3)}
                        </div>
                        <div className="truncate">
                          <p className="truncate font-medium">{tenant.name}</p>
                          <p className="text-[10px] text-slate-400">{tenant.code} • {tenant.settings.currency}</p>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setIsModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2 p-2 rounded-lg text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create New Workspace
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* New Tenant Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create New Business Workspace"
        description="Register a new isolated company database tenant."
      >
        <form onSubmit={handleCreateNewTenant} className="space-y-4">
          <Input
            label="Company / Business Name"
            placeholder="e.g. Omega Lights Intl"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!code) {
                setCode(
                  e.target.value
                    .split(' ')
                    .map((s) => s[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 5)
                );
              }
            }}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Company Code (Prefix)"
              placeholder="e.g. APEX"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              required
            />
            <Select
              label="Operating Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              options={[
                { value: 'USD', label: 'USD ($) - US Dollar' },
                { value: 'EUR', label: 'EUR (€) - Euro' },
                { value: 'GBP', label: 'GBP (£) - British Pound' },
                { value: 'CAD', label: 'CAD ($) - Canadian Dollar' },
                { value: 'AUD', label: 'AUD ($) - Australian Dollar' },
                { value: 'AED', label: 'AED (د.إ) - UAE Dirham' },
                { value: 'SAR', label: 'SAR (﷼) - Saudi Riyal' },
                { value: 'INR', label: 'INR (₹) - Indian Rupee' },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Official Email"
              type="email"
              placeholder="billing@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Phone Number"
              placeholder="+1 (555) 000-0000"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={submitting}>
              Initialize Tenant Workspace
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

'use client';

import React from 'react';
import { useTenant } from '@/context/TenantContext';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/Button';
import { ShieldCheck, Database, Layers, Lock, Plus } from 'lucide-react';
import Link from 'next/link';

interface ModuleFoundationStubProps {
  title: string;
  moduleKey: string;
  description: string;
  fields: string[];
}

export function ModuleFoundationStub({
  title,
  moduleKey,
  description,
  fields,
}: ModuleFoundationStubProps) {
  const { currentTenant } = useTenant();

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={`${description} • Scoped to ${currentTenant?.name}`}
        badge={
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <Database className="w-3.5 h-3.5" />
            Schema Ready
          </span>
        }
      />

      <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-2xs text-center max-w-2xl mx-auto space-y-6 my-8">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center mx-auto shadow-xs">
          <Layers className="w-7 h-7" />
        </div>

        <div>
          <h3 className="text-lg font-bold text-slate-900">{title} Architecture Initialized</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">{description}</p>
        </div>

        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-left text-xs font-mono space-y-2">
          <div className="flex items-center justify-between text-slate-700 font-semibold border-b border-slate-200 pb-2">
            <span>Firestore Subcollection Path:</span>
            <span className="text-indigo-600">tenants/{currentTenant?.id}/{moduleKey}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Configured Schema Fields:</span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {fields.map((field) => (
                <span key={field} className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                  {field}
                </span>
              ))}
              <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700">
                status: active | inactive
              </span>
              <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700">
                isDeleted: boolean
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Link href="/customers">
            <Button variant="outline" size="sm">
              Explore Active Customers Module
            </Button>
          </Link>
          <Link href="/products">
            <Button size="sm">
              Explore Active Products Module
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { Loader2, ShieldAlert, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, loading: authLoading, isSuspended, signOut } = useAuth();
  const { currentTenant, loading: tenantLoading } = useTenant();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [user, authLoading, router]);

  if (authLoading || tenantLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
        <p className="text-xs text-slate-500 font-medium">Synchronizing Workspace Security Context...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Real-time security lockout if account status is deactivated by an administrator
  if (isSuspended) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-2xl border border-slate-200 text-center space-y-5 animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-sm">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Account Deactivated</h2>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Your member account in <strong className="text-slate-800 font-semibold">{currentTenant?.name}</strong> has been set to <span className="text-rose-600 font-bold uppercase font-mono">Inactive</span> by a workspace administrator.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-left text-xs text-slate-600 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">User Identity:</span>
              <span className="font-semibold text-slate-800">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Tenant Workspace:</span>
              <span className="font-semibold text-slate-800">{currentTenant?.code || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Security Rule Status:</span>
              <span className="font-bold text-rose-600 font-mono">REVOKED (Real-time)</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400">
            Please contact your company owner or Super Admin to reactivate your access.
          </p>

          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              await signOut();
              router.replace('/login');
            }}
          >
            <LogOut className="w-4 h-4 mr-1.5" />
            Sign Out & Switch Account
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <Sidebar isMobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onMobileMenuToggle={() => setMobileMenuOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}

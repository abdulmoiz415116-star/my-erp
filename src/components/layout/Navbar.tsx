'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { TenantSwitcher } from './TenantSwitcher';
import { NotificationDrawer } from './NotificationDrawer';
import { useAuth } from '@/context/AuthContext';
import { useTenant } from '@/context/TenantContext';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { localReactiveStore } from '@/services/base.service';
import { useToast } from '@/context/ToastContext';
import { Bell, ShieldCheck, LogOut, User, Menu, Database, RefreshCw } from 'lucide-react';

interface NavbarProps {
  onMobileMenuToggle: () => void;
}

export function Navbar({ onMobileMenuToggle }: NavbarProps) {
  const { user, signOut, isMockAuth } = useAuth();
  const { userRole, currentTenant } = useTenant();
  const { showToast } = useToast();
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const isLiveFirebase = isFirebaseConfigured();

  const handleResyncData = () => {
    if (confirm('Synchronize and reset system workspace data for this organization? All real-time modules will be refreshed.')) {
      localReactiveStore.resetTenantData(currentTenant?.id || 'tenant-apex-corp');
      showToast('All enterprise collections synchronized & refreshed!', 'success');
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shadow-2xs">
      <div className="flex items-center gap-3">
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Tenant Switcher */}
        <TenantSwitcher />
      </div>

      {/* Right controls: Live indicator, notification, user */}
      <div className="flex items-center gap-3">
        {/* Real-time Connection Indicator */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs">
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isLiveFirebase ? 'bg-emerald-400' : 'bg-emerald-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isLiveFirebase ? 'bg-emerald-500' : 'bg-emerald-500'
              }`}
            />
          </span>
          <span className="text-[11px] font-medium text-slate-700">
            {isLiveFirebase ? 'Cloud Database Realtime' : 'Enterprise Realtime Sync'}
          </span>
        </div>

        {/* Sync System Cache Button */}
        {!isLiveFirebase && (
          <button
            onClick={handleResyncData}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors shadow-2xs"
            title="Refresh and synchronize workspace cache"
          >
            <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden md:inline">Sync Workspace</span>
          </button>
        )}

        {/* Live Operational Notifications */}
        <NotificationDrawer />

        {/* User Profile */}
        <div className="relative">
          <button
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-400 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {user?.displayName ? user.displayName.slice(0, 2).toUpperCase() : 'AD'}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-semibold text-slate-900 leading-none">
                {user?.displayName || 'Administrator'}
              </div>
              <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono mt-0.5">
                {userRole}
              </div>
            </div>
          </button>

          {userDropdownOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setUserDropdownOpen(false)} />
              <div className="absolute right-0 mt-2 w-56 rounded-xl bg-white shadow-xl border border-slate-200 z-30 p-2 animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-xs font-bold text-slate-900">{user?.displayName || 'Administrator'}</p>
                  <p className="text-[11px] text-slate-500 truncate">{user?.email || 'admin@erp.local'}</p>
                </div>

                <div className="py-1">
                  <div className="px-3 py-1.5 flex items-center justify-between text-xs text-slate-600">
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Role
                    </span>
                    <span className="font-semibold uppercase text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-700">
                      {userRole}
                    </span>
                  </div>

                  <Link
                    href="/profile"
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600 rounded-lg transition-colors"
                  >
                    <User className="w-4 h-4 text-slate-400" />
                    My Account & Security
                  </Link>
                </div>

                <div className="pt-1 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setUserDropdownOpen(false);
                      signOut();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

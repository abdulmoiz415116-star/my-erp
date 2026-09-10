'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Building,
  Package,
  FileText,
  ShoppingCart,
  Receipt,
  CreditCard,
  Landmark,
  ShieldCheck,
  History,
  Settings,
  Layers,
  ChevronRight,
  X,
  Store,
  BarChart3,
  Scale,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTenant } from '@/context/TenantContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Permission } from '@/types/permissions';

interface SidebarProps {
  isMobileOpen: boolean;
  onMobileClose: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  permission?: Permission;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export function Sidebar({ isMobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { currentTenant } = useTenant();
  const { can } = usePermissions();

  const navigation: NavSection[] = [
    {
      title: 'Core',
      items: [
        { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      title: 'Master Data',
      items: [
        { name: 'Customers', href: '/customers', icon: Users, permission: 'customers:view' },
        { name: 'Suppliers', href: '/suppliers', icon: Building, permission: 'suppliers:view' },
        { name: 'Products & Catalog', href: '/products', icon: Package, permission: 'products:view' },
      ],
    },
    {
      title: 'Operations',
      items: [
        { name: 'POS / Checkout', href: '/pos', icon: Store, permission: 'pos:access' },
        { name: 'Sales Invoices', href: '/sales', icon: FileText, permission: 'sales:view' },
        { name: 'Purchase Orders', href: '/purchases', icon: ShoppingCart, permission: 'purchases:view' },
        { name: 'Expenses', href: '/expenses', icon: Receipt, permission: 'expenses:view' },
        { name: 'Payments', href: '/payments', icon: CreditCard, permission: 'payments:view' },
      ],
    },
    {
      title: 'Financials & Banking',
      items: [
        { name: 'Accounting & Ledger', href: '/accounting', icon: Scale, permission: 'accounting:view' },
        { name: 'Cash & Bank Accounts', href: '/accounts', icon: Landmark, permission: 'accounts:view' },
        { name: 'Financial Reports', href: '/reports', icon: BarChart3, permission: 'reports:view' },
      ],
    },
    {
      title: 'Administration',
      items: [
        { name: 'Users & Roles', href: '/users', icon: ShieldCheck, permission: 'users:view' },
        { name: 'Audit Logs', href: '/audit-logs', icon: History, permission: 'audit:view' },
        { name: 'Company Settings', href: '/settings', icon: Settings, permission: 'settings:view' },
      ],
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300">
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-800 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-amber-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-white text-base tracking-tight">Omega Lights ERP</span>
            <span className="block text-[10px] text-amber-400 font-mono font-semibold uppercase">Enterprise Edition</span>
          </div>
        </Link>
        <button
          onClick={onMobileClose}
          className="lg:hidden text-slate-400 hover:text-white p-1 rounded-md"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
        {navigation.map((section) => {
          const visibleItems = section.items.filter((item) => {
            if (!item.permission) return true;
            return can(item.permission);
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className="space-y-1">
              <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                {section.title}
              </p>
              <div className="space-y-0.5 mt-2">
                {visibleItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onMobileClose}
                      className={cn(
                        'flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group select-none',
                        isActive
                          ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={cn(
                            'w-4 h-4 transition-colors',
                            isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                          )}
                        />
                        <span>{item.name}</span>
                      </div>

                      {item.badge && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-200 font-mono">
                          {item.badge}
                        </span>
                      )}

                      {isActive && <ChevronRight className="w-3.5 h-3.5 text-indigo-200" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Workspace Footer Info */}
      <div className="p-4 border-t border-slate-800 shrink-0 bg-slate-950/40">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <div className="truncate">
            <span className="block text-slate-200 font-semibold truncate">
              {currentTenant?.name || 'Workspace'}
            </span>
            <span className="text-[10px] font-mono text-indigo-400">ID: {currentTenant?.code || '—'}</span>
          </div>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            Active
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-64 h-screen shrink-0 sticky top-0 border-r border-slate-800">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs" onClick={onMobileClose} />
          <div className="fixed inset-y-0 left-0 w-72 max-w-full shadow-2xl z-50">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

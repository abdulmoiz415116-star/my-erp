import type { Metadata } from 'next';
import './globals.css';
import { ToastProvider } from '@/context/ToastContext';
import { AuthProvider } from '@/context/AuthContext';
import { TenantProvider } from '@/context/TenantContext';

export const metadata: Metadata = {
  title: 'Antigravity Enterprise ERP',
  description: 'High-performance production Business ERP Management System with Firebase Multi-Tenancy',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        <ToastProvider>
          <AuthProvider>
            <TenantProvider>{children}</TenantProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}

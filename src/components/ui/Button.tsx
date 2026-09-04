'use client';

import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'warning' | 'outline' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading = false, disabled, children, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-[0.98]';

    const variants = {
      primary: 'bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500 shadow-sm',
      secondary: 'bg-slate-100 text-slate-800 hover:bg-slate-200 focus:ring-slate-400 border border-slate-200',
      outline: 'border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 focus:ring-indigo-500 shadow-xs',
      danger: 'bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500 shadow-sm',
      warning: 'bg-amber-600 text-white hover:bg-amber-700 focus:ring-amber-500 shadow-sm',
      success: 'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500 shadow-sm',
      ghost: 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:ring-slate-400',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs gap-1.5',
      md: 'h-9 px-4 text-sm gap-2',
      lg: 'h-11 px-5 text-base gap-2.5',
      icon: 'h-9 w-9 p-0',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin text-current shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

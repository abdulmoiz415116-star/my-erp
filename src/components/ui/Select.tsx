'use client';

import React, { SelectHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options?: SelectOption[];
  children?: React.ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, id, children, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-semibold text-slate-700 tracking-wide">
            {label}
            {props.required && <span className="text-rose-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative rounded-lg shadow-2xs">
          <select
            id={selectId}
            ref={ref}
            className={cn(
              'block w-full appearance-none rounded-lg border border-slate-300 bg-white text-slate-900 text-sm py-2 pl-3 pr-10 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed',
              error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-500',
              className
            )}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';

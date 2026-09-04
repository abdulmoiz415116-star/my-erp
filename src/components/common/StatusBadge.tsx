import React from 'react';
import { RecordStatus } from '@/types/common';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: RecordStatus | string;
  size?: 'sm' | 'md';
  onClick?: () => void;
  className?: string;
}

export function StatusBadge({ status, size = 'sm', onClick, className }: StatusBadgeProps) {
  const isActive = status === 'active';

  return (
    <span
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full border transition-all select-none',
        isActive
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : 'bg-slate-100 text-slate-600 border-slate-200',
        size === 'sm' ? 'text-[11px] px-2.5 py-0.5' : 'text-xs px-3 py-1',
        onClick && 'cursor-pointer hover:shadow-xs active:scale-95',
        className
      )}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
        )}
      />
      <span className="capitalize font-semibold">{status}</span>
    </span>
  );
}

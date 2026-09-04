import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'USD', symbol = '$'): string {
  if (isNaN(amount)) return `${symbol}0.00`;
  return `${symbol}${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoString;
  }
}

export function formatDateTime(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function compareValues(a: unknown, b: unknown, direction: 'asc' | 'desc'): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return direction === 'asc' ? 1 : -1;
  if (b === null || b === undefined) return direction === 'asc' ? -1 : 1;
  if (typeof a === 'number' && typeof b === 'number') {
    return direction === 'asc' ? a - b : b - a;
  }
  const strA = String(a).toLowerCase();
  const strB = String(b).toLowerCase();
  if (strA < strB) return direction === 'asc' ? -1 : 1;
  if (strA > strB) return direction === 'asc' ? 1 : -1;
  return 0;
}

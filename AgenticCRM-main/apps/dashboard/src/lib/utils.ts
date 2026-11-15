import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount / 100);
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}

// ── Dashboard formatting ─────────────────────────────────────────────────────
// All dashboard endpoints return money in MAJOR units (rupees, not paise) with an
// explicit currency code, so these helpers never divide by 100.

export function formatMoney(amount: number, currency = 'INR', opts: { compact?: boolean } = {}): string {
  const compact = opts.compact ?? Math.abs(amount) >= 100000;
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency',
    currency,
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 0,
  }).format(amount);
}

export function formatCompact(n: number): string {
  // Counts use K/M everywhere; only rupee amounts use lakh/crore (see formatMoney).
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export function formatPercent(n: number, digits = 1): string {
  return `${n.toFixed(digits).replace(/\.0+$/, '')}%`;
}

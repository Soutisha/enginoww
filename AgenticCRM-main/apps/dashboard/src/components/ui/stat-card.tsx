'use client';

import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { chartColors } from '@/lib/chart-theme';
import { cn } from '@/lib/utils';
import { Card } from './card';
import { Skeleton } from './skeleton';
import { AnimatedMetric } from './animated-metric';

/** Percent change vs the previous period. `invert` flips colouring for metrics where lower is better. */
export function Delta({ value, invert = false, suffix = '%' }: { value: number | null | undefined; invert?: boolean; suffix?: string }) {
  if (value == null) return null;
  const flat = Math.abs(value) < 0.05;
  const good = invert ? value < 0 : value > 0;
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        'num inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium',
        flat ? 'bg-raised text-ink-dim' : good ? 'bg-positive/15 text-positive' : 'bg-negative/15 text-negative',
      )}
      title="Change vs previous period"
    >
      <Icon size={11} aria-hidden />
      {Math.abs(value).toFixed(1)}{suffix}
      <span className="sr-only">{flat ? 'no change' : value > 0 ? 'increase' : 'decrease'} versus previous period</span>
    </span>
  );
}

export function StatCard({
  label, value, hint, delta, deltaSuffix, invertDelta, icon: Icon, spark, loading, children, className,
}: {
  label: string;
  value?: ReactNode;
  hint?: ReactNode;
  delta?: number | null;
  deltaSuffix?: string;
  invertDelta?: boolean;
  icon?: LucideIcon;
  spark?: number[];
  loading?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const gradientId = useId();
  return (
    <Card className={cn('relative overflow-hidden p-5', className)} aria-busy={loading || undefined}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs text-ink-dim">
          {Icon && <Icon size={14} aria-hidden className="text-ink-faint" />}
          {label}
        </p>
        {!loading && <Delta value={delta} invert={invertDelta} suffix={deltaSuffix} />}
      </div>
      {loading ? (
        <div className="mt-3 space-y-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      ) : (
        <>
          <p className="num mt-2 text-[28px] font-semibold leading-none tracking-tight text-ink">{typeof value === 'string' || typeof value === 'number' ? <AnimatedMetric value={value} /> : value}</p>
          {hint && <p className="mt-2 text-xs text-ink-dim">{hint}</p>}
          {children}
        </>
      )}
      {!loading && spark && spark.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 opacity-70" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark.map((v, i) => ({ i, v }))} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColors.signal} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={chartColors.signal} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={chartColors.signal} strokeWidth={1.5} fill={`url(#${gradientId})`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

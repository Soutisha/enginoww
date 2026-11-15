import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const badge = cva('inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium', {
  variants: {
    tone: {
      neutral: 'bg-raised text-ink-dim',
      signal: 'bg-signal/15 text-signal',
      positive: 'bg-positive/15 text-positive',
      negative: 'bg-negative/15 text-negative',
      warning: 'bg-warning/15 text-warning',
      cyan: 'bg-cyan/15 text-cyan',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badge> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}

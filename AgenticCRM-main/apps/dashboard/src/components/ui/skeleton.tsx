import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** Decorative placeholder. Parents should set aria-busy on the region that is loading. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('skeleton rounded-md', className)} {...props} />;
}

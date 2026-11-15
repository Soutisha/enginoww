import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn('premium-card rounded-panel border border-line bg-panel shadow-raise', className)}
      {...props}
    />
  );
}

export function CardHeader({
  title, description, action, className,
}: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <header className={cn('flex items-start justify-between gap-3 px-5 pt-4', className)}>
      <div className="min-w-0">
        <h2 className="truncate text-sm font-medium text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-ink-dim">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pb-5 pt-3', className)} {...props} />;
}

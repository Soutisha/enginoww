import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function EmptyState({
  icon: Icon, title, description, action, className,
}: { icon?: LucideIcon; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-10 text-center', className)}>
      {Icon && (
        <span className="mb-1 grid h-10 w-10 place-items-center rounded-xl border border-line bg-raised text-ink-dim">
          <Icon size={18} aria-hidden />
        </span>
      )}
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="max-w-xs text-xs text-ink-dim">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

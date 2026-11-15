import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardBody, CardHeader } from './card';
import { EmptyState } from './empty-state';
import { Skeleton } from './skeleton';

/** Card + header with built-in loading and empty states for any chart body. */
export function ChartCard({
  title, description, action, loading, empty, height = 240, className, children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  loading?: boolean;
  empty?: { icon?: LucideIcon; title: string; description?: string } | false;
  height?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn('flex flex-col', className)} aria-busy={loading || undefined}>
      <CardHeader title={title} description={description} action={action} />
      <CardBody className="flex-1">
        <div style={{ minHeight: height }} className="flex flex-col justify-center">
          {loading ? (
            <Skeleton className="w-full" style={{ height }} />
          ) : empty ? (
            <EmptyState {...empty} />
          ) : (
            <div style={{ height }}>{children}</div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { EmptyState } from './empty-state';
import { Skeleton } from './skeleton';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right';
  /** Hide below the `md` breakpoint to keep tables readable on phones. */
  hideOnMobile?: boolean;
  className?: string;
}

export function DataTable<T>({
  columns, rows, rowKey, loading, skeletonRows = 5, empty, onRowClick,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  loading?: boolean;
  skeletonRows?: number;
  empty?: { icon?: LucideIcon; title: string; description?: string; action?: ReactNode };
  onRowClick?: (row: T) => void;
}) {
  const showEmpty = !loading && (rows?.length ?? 0) === 0;
  return (
    <div className="scroll-thin overflow-x-auto" aria-busy={loading || undefined}>
      <table className="w-full min-w-[420px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-faint">
            {columns.map((c) => (
              <th
                key={c.key} scope="col"
                className={cn('whitespace-nowrap px-5 py-2 font-medium', c.align === 'right' && 'text-right', c.hideOnMobile && 'hidden md:table-cell', c.className)}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading && Array.from({ length: skeletonRows }).map((_, i) => (
            <tr key={i} className="border-b border-line/60 last:border-0">
              {columns.map((c) => (
                <td key={c.key} className={cn('px-5 py-3', c.hideOnMobile && 'hidden md:table-cell')}>
                  <Skeleton className="h-4 w-3/4" />
                </td>
              ))}
            </tr>
          ))}
          {!loading && rows?.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn('border-b border-line/60 last:border-0', onRowClick && 'cursor-pointer transition-colors hover:bg-raised/60')}
            >
              {columns.map((c) => (
                <td key={c.key} className={cn('px-5 py-3 text-ink', c.align === 'right' && 'text-right num', c.hideOnMobile && 'hidden md:table-cell', c.className)}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {showEmpty && empty && <EmptyState {...empty} />}
    </div>
  );
}

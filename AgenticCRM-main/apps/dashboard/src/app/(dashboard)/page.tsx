'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AlertTriangle, FlaskConical, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import {
  ActivityCard, AgentsCard, ConversationsCard, FollowUpsCard, FunnelCard, KpiTiles, RevenueHero,
} from '@/components/dashboard/widgets';
import type { OverviewData } from '@/components/dashboard/types';
import { Button, Card, Stagger, StaggerItem } from '@/components/ui';
import api from '@/lib/api-client';
import { cn } from '@/lib/utils';

const RANGES = [7, 30, 90] as const;

export default function DashboardPage() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);

  const { data, isLoading, isError, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['dashboard-overview', days],
    queryFn: () => api.get(`/analytics/overview?days=${days}`).then((r) => r.data.data as OverviewData),
    placeholderData: keepPreviousData, // switching range keeps the old numbers visible instead of flashing skeletons
    refetchInterval: 60_000,
  });

  const { data: demoStatus } = useQuery({
    queryKey: ['company-demo-data'],
    queryFn: () => api.get('/company/demo-data').then((r) => r.data.data as {
      loaded: boolean;
      counts: { contacts: number; leads: number; deals: number; tasks: number; products: number; payments: number; conversations: number };
    }),
    staleTime: 60_000,
  });

  return (
    <div className="space-y-4">
      {demoStatus?.loaded && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3" role="status">
          <span className="mt-0.5 rounded-md bg-white p-1.5 text-amber-700"><FlaskConical size={15} /></span>
          <div>
            <p className="text-xs font-semibold text-amber-950">Demo data is enabled</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-amber-900">
              This dashboard includes fictional sample records and simulated payments for demonstration. Simulated payments are not actual revenue. Manage sample records in Settings → Company.
            </p>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-dim">
          {dataUpdatedAt ? `Updated ${new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Loading your numbers…'}
        </p>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Time range" className="flex rounded-lg border border-line bg-panel p-0.5">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setDays(r)}
                aria-pressed={days === r}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  days === r ? 'bg-overlay text-ink' : 'text-ink-dim hover:text-ink',
                )}
              >
                {r} days
              </button>
            ))}
          </div>
          <Button variant="ghost" size="icon" onClick={() => refetch()} aria-label="Refresh dashboard" disabled={isFetching}>
            <RefreshCw size={15} className={cn(isFetching && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {isError && !data ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center" role="alert">
          <AlertTriangle className="text-warning" size={22} aria-hidden />
          <div>
            <p className="text-sm font-medium text-ink">Couldn&apos;t load the dashboard</p>
            <p className="mt-1 text-xs text-ink-dim">The server didn&apos;t respond. Check your connection and try again.</p>
          </div>
          <Button onClick={() => refetch()}>Try again</Button>
        </Card>
      ) : (
        <Stagger className="grid grid-cols-1 gap-4 xl:grid-cols-12 [&>*>*]:h-full">
          <StaggerItem className="xl:col-span-6"><RevenueHero data={data} loading={isLoading} /></StaggerItem>
          <StaggerItem className="xl:col-span-6"><KpiTiles data={data} loading={isLoading} /></StaggerItem>
          <StaggerItem className="xl:col-span-4"><FunnelCard data={data} loading={isLoading} /></StaggerItem>
          <StaggerItem className="xl:col-span-8"><ActivityCard data={data} loading={isLoading} /></StaggerItem>
          <StaggerItem className="xl:col-span-7"><ConversationsCard data={data} loading={isLoading} /></StaggerItem>
          <StaggerItem className="xl:col-span-5"><FollowUpsCard data={data} loading={isLoading} /></StaggerItem>
          <StaggerItem className="xl:col-span-12"><AgentsCard data={data} loading={isLoading} /></StaggerItem>
        </Stagger>
      )}
    </div>
  );
}

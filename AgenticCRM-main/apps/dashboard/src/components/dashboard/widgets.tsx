'use client';

import { format } from 'date-fns';
import {
  Bot, CheckCircle2, CircleDollarSign, Clock, Inbox, LineChart as LineChartIcon,
  Target, TrendingUp, Users, Zap,
} from 'lucide-react';
import Link from 'next/link';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Badge, Card, CardBody, CardHeader, ChartCard, DataTable, EmptyState, StatCard,
  type Column,
} from '@/components/ui';
import { axisProps, chartColors, rampColors, tooltipStyle } from '@/lib/chart-theme';
import { cn, formatCompact, formatMoney, formatPercent, formatRelativeTime } from '@/lib/utils';
import type { OverviewData } from './types';

type Props = { data?: OverviewData; loading: boolean };

const shortDate = (d: string) => format(new Date(`${d}T00:00:00`), 'd MMM');

function durationLabel(iso: string): string {
  const mins = Math.max(1, Math.round(Math.abs(Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h` : `${Math.round(hrs / 24)}d`;
}

// ── Revenue overview (hero) ───────────────────────────────────────────────────
export function RevenueHero({ data, loading }: Props) {
  const r = data?.revenue;
  const hasRevenue = !!r && r.series.some((p) => p.value > 0);
  return (
    <ChartCard
      title="Revenue"
      description={r?.mixedCurrency ? `Paid payments in ${r.currency}; other currencies are excluded` : 'Paid payments, net of refunds'}
      loading={loading}
      height={220}
      empty={!hasRevenue ? { icon: CircleDollarSign, title: 'No payments in this period', description: 'Paid payment links and invoices will appear here.' } : false}
      className="h-full"
    >
      {r && (
        <div className="flex h-full flex-col">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="num text-4xl font-semibold tracking-tight text-ink">{formatMoney(r.total, r.currency, { compact: false })}</p>
            {r.deltaPct != null && (
              <span className={cn('num text-sm font-medium', r.deltaPct >= 0 ? 'text-positive' : 'text-negative')}>
                {r.deltaPct >= 0 ? '+' : ''}{r.deltaPct}% <span className="font-normal text-ink-dim">vs previous {data!.days} days</span>
              </span>
            )}
          </div>
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={r.series} margin={{ top: 8, right: 4, bottom: 0, left: -8 }}>
                <defs>
                  <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColors.signal} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={chartColors.signal} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={chartColors.grid} />
                <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={32} {...axisProps} />
                <YAxis tickFormatter={(v: number) => formatMoney(v, r.currency, { compact: true })} width={56} {...axisProps} />
                <Tooltip {...tooltipStyle} labelFormatter={(l) => shortDate(String(l))} formatter={(v) => [formatMoney(Number(v), r.currency, { compact: false }), 'Revenue']} />
                <Area type="monotone" dataKey="value" stroke={chartColors.signal} strokeWidth={2} fill="url(#rev-fill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </ChartCard>
  );
}

// ── KPI tiles ─────────────────────────────────────────────────────────────────
export function KpiTiles({ data, loading }: Props) {
  const d = data;
  return (
    <div className="grid h-full grid-cols-1 gap-4 sm:grid-cols-2 sm:grid-rows-2">
      <StatCard
        icon={Users} label="Total leads" loading={loading}
        value={d ? formatCompact(d.leads.total) : undefined}
        delta={d?.leads.deltaPct}
        hint={d && `${formatCompact(d.leads.open)} still open`}
      />
      <StatCard
        icon={Target} label="Conversion rate" loading={loading}
        value={d ? formatPercent(d.conversion.rate) : undefined}
        delta={d?.conversion.deltaPoints} deltaSuffix=" pts"
        hint={d && `${d.conversion.won} won of ${d.conversion.leads} new leads`}
      />
      <StatCard
        icon={Clock} label="Pending follow-ups" loading={loading}
        value={d?.followUps.total}
        hint={d && (d.followUps.overdue > 0 ? `${d.followUps.overdue} overdue` : 'Nothing overdue')}
      />
      <StatCard
        icon={TrendingUp} label="Open pipeline" loading={loading}
        value={d ? formatMoney(d.revenue.openPipeline.value, d.revenue.currency) : undefined}
        hint={d && `${d.revenue.openPipeline.deals} open deals`}
      />
    </div>
  );
}

// ── Sales funnel ──────────────────────────────────────────────────────────────
export function FunnelCard({ data, loading }: Props) {
  const top = data?.funnel[0]?.count ?? 0;
  return (
    <ChartCard
      title="Sales funnel"
      description={data ? `Leads created in the last ${data.days} days` : undefined}
      loading={loading}
      height={240}
      empty={top === 0 ? { icon: Target, title: 'No leads in this period', description: 'New leads from WhatsApp, forms and integrations will fill the funnel.' } : false}
    >
      <ol className="flex h-full flex-col justify-between gap-3">
        {data?.funnel.map((s, i) => (
          <li key={s.key}>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="text-ink">{s.label}</span>
              <span className="num text-ink-dim">{s.count} <span className="text-ink-faint">· {formatPercent(s.rate)}</span></span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-raised" role="img" aria-label={`${s.label}: ${s.count} leads, ${formatPercent(s.rate)} of new leads`}>
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out"
                style={{ width: `${top > 0 ? Math.max((s.count / top) * 100, s.count > 0 ? 3 : 0) : 0}%`, background: rampColors[i] }}
              />
            </div>
          </li>
        ))}
      </ol>
    </ChartCard>
  );
}

// ── Daily activity ────────────────────────────────────────────────────────────
const ACTIVITY_SERIES = [
  { key: 'inbound', label: 'Customer messages', color: chartColors.cyan },
  { key: 'ai', label: 'AI replies', color: chartColors.signal },
  { key: 'human', label: 'Team replies', color: '#5d6a8c' },
] as const;

export function ActivityCard({ data, loading }: Props) {
  const total = data?.activity.reduce((s, d) => s + d.inbound + d.ai + d.human, 0) ?? 0;
  return (
    <ChartCard
      title="Daily activity"
      description="WhatsApp messages per day"
      loading={loading}
      height={240}
      empty={total === 0 ? { icon: Inbox, title: 'No messages in this period', description: 'Connect a WhatsApp number in Settings to start receiving conversations.' } : false}
      action={
        <ul className="flex flex-wrap justify-end gap-x-3 gap-y-1 text-[11px] text-ink-dim">
          {ACTIVITY_SERIES.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} aria-hidden />{s.label}
            </li>
          ))}
        </ul>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data?.activity} margin={{ top: 8, right: 4, bottom: 0, left: -16 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke={chartColors.grid} />
          <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={32} {...axisProps} />
          <YAxis allowDecimals={false} width={44} {...axisProps} />
          <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.04)' }} labelFormatter={(l) => shortDate(String(l))} />
          {ACTIVITY_SERIES.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={s.color} maxBarSize={22} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ── Recent conversations ──────────────────────────────────────────────────────
const STATUS: Record<string, { label: string; tone: 'neutral' | 'signal' | 'positive' | 'negative' | 'warning' | 'cyan' }> = {
  OPEN: { label: 'Open', tone: 'cyan' },
  AI_HANDLING: { label: 'AI handling', tone: 'signal' },
  WAITING_HUMAN: { label: 'Needs a person', tone: 'warning' },
  HUMAN_HANDLING: { label: 'With team', tone: 'positive' },
  RESOLVED: { label: 'Resolved', tone: 'neutral' },
  CLOSED: { label: 'Closed', tone: 'neutral' },
  SPAM: { label: 'Spam', tone: 'negative' },
};

export function ConversationsCard({ data, loading }: Props) {
  const columns: Column<OverviewData['recentConversations'][number]>[] = [
    {
      key: 'contact', header: 'Contact',
      cell: (c) => (
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-medium">
            <span className="truncate">{c.contact}</span>
            {c.unread > 0 && <span className="num rounded-full bg-signal px-1.5 text-[10px] font-semibold text-primary-foreground">{c.unread}</span>}
          </p>
          <p className="max-w-[260px] truncate text-xs text-ink-dim">{c.lastMessage ?? 'No text'}</p>
        </div>
      ),
    },
    {
      key: 'status', header: 'Status', hideOnMobile: true,
      cell: (c) => {
        const s = STATUS[c.status] ?? { label: c.status, tone: 'neutral' as const };
        return <Badge tone={s.tone}>{s.label}</Badge>;
      },
    },
    { key: 'owner', header: 'Owner', hideOnMobile: true, cell: (c) => <span className="whitespace-nowrap text-ink-dim">{c.assignee ?? (c.aiEnabled ? 'AI agent' : 'Unassigned')}</span> },
    { key: 'time', header: 'Last message', align: 'right', cell: (c) => <span className="text-ink-dim">{formatRelativeTime(c.lastMessageAt)}</span> },
  ];
  return (
    <Card className="h-full">
      <CardHeader title="Recent conversations" description="Latest WhatsApp threads" />
      <div className="pt-3">
        <DataTable
          columns={columns} rows={data?.recentConversations} rowKey={(c) => c.id} loading={loading}
          empty={{ icon: Inbox, title: 'No conversations yet', description: 'Customer chats appear here as soon as someone messages your number.' }}
        />
      </div>
    </Card>
  );
}

// ── Pending follow-ups ────────────────────────────────────────────────────────
const KIND_LABEL = { task: 'Task', lead: 'Lead', deal: 'Deal' } as const;

export function FollowUpsCard({ data, loading }: Props) {
  const f = data?.followUps;
  return (
    <Card className="h-full" aria-busy={loading || undefined}>
      <CardHeader
        title="Pending follow-ups"
        description="Overdue or due in the next 24 hours"
        action={f && f.breakdown.waitingConversations > 0 ? <Badge tone="warning">{f.breakdown.waitingConversations} chats waiting for a person</Badge> : undefined}
      />
      <CardBody className="px-2">
        {loading ? (
          <div className="space-y-2 px-3 py-1">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-11 rounded-lg" aria-hidden />)}</div>
        ) : !f || f.items.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="You're all caught up" description="Tasks, leads and deals that need attention will show up here." />
        ) : (
          <ul>
            {f.items.map((i) => (
              <li key={`${i.kind}-${i.id}`}>
                <Link href={i.href} className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-raised">
                  <span className={cn('h-8 w-1 shrink-0 rounded-full', i.overdue ? 'bg-negative' : 'bg-warning')} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{i.title}</span>
                    <span className="block truncate text-xs text-ink-dim">{KIND_LABEL[i.kind]} · {i.contact}{i.note ? ` · ${i.note}` : ''}</span>
                  </span>
                  <span className={cn('num shrink-0 text-xs', i.overdue ? 'text-negative' : 'text-ink-dim')}>
                    {i.overdue ? `Overdue ${durationLabel(i.dueAt)}` : `In ${durationLabel(i.dueAt)}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

// ── Agent activity ────────────────────────────────────────────────────────────
function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-line bg-raised/50 px-3 py-2.5">
      <p className="num text-lg font-semibold leading-tight text-ink">{value}</p>
      <p className="text-[11px] text-ink-dim">{label}</p>
    </div>
  );
}

export function AgentsCard({ data, loading }: Props) {
  const a = data?.agents;
  return (
    <Card aria-busy={loading || undefined}>
      <CardHeader title="Agent activity" description={data ? `AI agent and team, last ${data.days} days` : undefined} />
      {loading || !a ? (
        <CardBody><div className="skeleton h-48 w-full rounded-lg" aria-hidden /></CardBody>
      ) : (
        <CardBody className="grid gap-6 lg:grid-cols-3">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-medium text-ink"><Bot size={14} className="text-signal" aria-hidden />AI agent</p>
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Replies sent" value={formatCompact(a.ai.replies)} />
              <Metric label="CRM actions" value={formatCompact(a.ai.actions)} />
              <Metric label="Avg. response" value={a.ai.avgLatencyMs != null ? `${(a.ai.avgLatencyMs / 1000).toFixed(1)}s` : '—'} />
              <Metric label="Tokens used" value={formatCompact(a.ai.tokens)} />
            </div>
            <p className="mt-3 text-xs text-ink-dim">
              <span className="num text-ink">{a.ai.handlingNow}</span> chats handled now ·{' '}
              <span className="num text-ink">{a.ai.escalated}</span> waiting for a person
            </p>
          </div>

          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-medium text-ink"><Users size={14} className="text-cyan" aria-hidden />Team</p>
            {a.team.length === 0 ? (
              <EmptyState icon={Users} title="No team activity yet" description="Replies, completed tasks and won deals will be ranked here." className="py-6" />
            ) : (
              <ul className="space-y-2.5">
                {a.team.map((u) => (
                  <li key={u.id} className="flex items-center gap-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-raised text-xs font-medium text-ink" aria-hidden>{u.name[0]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{u.name}</span>
                      <span className="num block truncate text-xs text-ink-dim">{u.messages} replies · {u.tasksDone} tasks · {u.dealsWon} won</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-medium text-ink"><Zap size={14} className="text-warning" aria-hidden />Latest AI actions</p>
            {a.recent.length === 0 ? (
              <EmptyState icon={LineChartIcon} title="No AI actions yet" description="Leads, deals and tasks the agent touches will be listed here." className="py-6" />
            ) : (
              <ul className="space-y-1">
                {a.recent.map((e) => (
                  <li key={`${e.kind}-${e.id}`}>
                    <Link href={e.href} className="flex items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-raised">
                      <Badge>{KIND_LABEL[e.kind]}</Badge>
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{e.title}</span>
                      <span className="shrink-0 text-xs text-ink-faint">{formatRelativeTime(e.at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardBody>
      )}
    </Card>
  );
}

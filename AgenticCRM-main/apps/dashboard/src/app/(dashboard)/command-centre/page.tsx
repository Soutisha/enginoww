'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity, Bot, Boxes, BriefcaseBusiness, CircleDot, ExternalLink,
  Layers3, Maximize2, MessageSquare, Package, Radio, RefreshCw, Users, Workflow, X,
} from 'lucide-react';
import api from '@/lib/api-client';
import { getSocket } from '@/hooks/use-socket';
import { BusinessNetworkCanvas, type NetworkNode } from '@/components/command-centre/business-network-canvas';

type ActivityItem = {
  id: string; kind: string; title: string; detail?: string | null; at?: string | null;
  entityId: string; status?: string; aiEnabled?: boolean; unreadCount?: number; assignedTo?: string | null; latencyMs?: number | null;
};
type Snapshot = {
  generatedAt: string;
  stats: { contacts: number; leads: number; openDeals: number; activeProducts: number; waitingHuman: number; aiReplies24h: number };
  nodes: NetworkNode[];
  links: { source: string; target: string; kind: string }[];
  activity: ActivityItem[];
  agents: { id: string; name: string; role: string; lastLoginAt: string | null }[];
};

const FILTERS = [
  { id: 'contact', label: 'Customers', color: '#55d6be' },
  { id: 'lead', label: 'Leads', color: '#8b9cff' },
  { id: 'deal', label: 'Deals', color: '#c49aff' },
  { id: 'product', label: 'Products', color: '#f4b86a' },
  { id: 'agent', label: 'Team', color: '#f18fb4' },
];
function count(value: number) { return new Intl.NumberFormat('en-IN', { notation: value > 9999 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value); }
function timeAgo(value?: string | null) {
  if (!value) return 'No recent activity';
  const mins = Math.floor(Math.max(0, Date.now() - new Date(value).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}
function money(value?: number | null, currency = 'INR') {
  if (value == null) return '—';
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value); }
  catch { return `${currency} ${Math.round(value)}`; }
}
function hrefFor(node: NetworkNode) {
  if (node.kind === 'contact') return `/contacts/${node.entityId}`;
  if (node.kind === 'lead') return `/leads/${node.entityId}`;
  if (node.kind === 'deal') return `/deals/${node.entityId}`;
  if (node.kind === 'product') return `/products/${node.entityId}`;
  if (node.kind === 'agent') return '/agents';
  return '/';
}

export default function CommandCentrePage() {
  const queryClient = useQueryClient();
  const [visibleKinds, setVisibleKinds] = useState(FILTERS.map((item) => item.id));
  const [selected, setSelected] = useState<NetworkNode | null>(null);
  const [showActivity, setShowActivity] = useState(true);
  const { data, isLoading, isError, isFetching, dataUpdatedAt, refetch } = useQuery({
    queryKey: ['analytics-command-centre'],
    queryFn: () => api.get('/analytics/command-centre').then((response) => response.data.data as Snapshot),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['analytics-command-centre'] });
    socket.on('message.new', refresh);
    socket.on('conversation.updated', refresh);
    socket.on('notification.new', refresh);
    return () => {
      socket.off('message.new', refresh);
      socket.off('conversation.updated', refresh);
      socket.off('notification.new', refresh);
    };
  }, [queryClient]);

  const selectedNode = useMemo(() => selected && data?.nodes.find((node) => node.id === selected.id) || selected, [data?.nodes, selected]);
  const activeCount = data?.nodes.filter((node) => visibleKinds.includes(node.kind)).length ?? 0;
  const toggleKind = (kind: string) => setVisibleKinds((current) => current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind]);

  return (
    <div className="min-h-full space-y-5 bg-[#080d19] p-4 text-slate-100 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-indigo-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399]" /> Live business intelligence</div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">3D Business Command Centre</h1>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">Explore how customers, leads, deals, products and your team connect across the business.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-[10px] text-emerald-300 sm:flex"><Radio size={12} /> Live sync · 30s refresh</span>
          <button onClick={() => refetch()} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300 transition hover:bg-white/[0.08]" aria-label="Refresh command centre"><RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} /> Refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {[
          { label: 'Customers', value: data?.stats.contacts, icon: Users, color: 'text-teal-300' },
          { label: 'Leads', value: data?.stats.leads, icon: CircleDot, color: 'text-indigo-300' },
          { label: 'Open deals', value: data?.stats.openDeals, icon: BriefcaseBusiness, color: 'text-violet-300' },
          { label: 'Active products', value: data?.stats.activeProducts, icon: Boxes, color: 'text-amber-300' },
          { label: 'Human handoffs', value: data?.stats.waitingHuman, icon: MessageSquare, color: 'text-rose-300' },
          { label: 'AI replies · 24h', value: data?.stats.aiReplies24h, icon: Bot, color: 'text-sky-300' },
        ].map((item) => <div key={item.label} className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.12)]"><div className="flex items-center justify-between"><span className="text-[10px] uppercase tracking-wider text-slate-500">{item.label}</span><item.icon size={14} className={item.color} /></div><div className="mt-2 text-2xl font-semibold tabular-nums text-white">{isLoading ? '—' : count(item.value ?? 0)}</div></div>)}
      </div>

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_330px]">
        <section className="overflow-hidden rounded-2xl border border-indigo-300/10 bg-[radial-gradient(ellipse_at_50%_44%,rgba(43,67,122,0.24),rgba(11,17,31,0.95)_66%)] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3"><div className="flex items-center gap-2"><Layers3 size={14} className="text-indigo-300" /><span className="text-xs font-medium text-slate-200">Business network</span><span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] text-slate-400">{activeCount} objects</span></div><button onClick={() => setShowActivity((value) => !value)} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[10px] text-slate-400 hover:bg-white/[0.06] hover:text-white"><Activity size={12} /> {showActivity ? 'Hide' : 'Show'} activity</button></div>
          <div className="relative h-[440px] min-h-[360px] sm:h-[540px]">
            {isLoading ? <div className="absolute inset-0 grid place-items-center"><div className="text-center"><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-indigo-300/20 border-t-indigo-300" /><p className="text-xs text-slate-400">Loading your business network…</p></div></div>
              : isError ? <div className="absolute inset-0 grid place-items-center px-6 text-center"><div><p className="text-sm font-medium text-white">Could not load business data</p><p className="mt-1 text-xs text-slate-400">Check your analytics permission and API connection, then retry.</p><button onClick={() => refetch()} className="mt-3 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-medium text-white">Try again</button></div></div>
              : data?.nodes.length ? <BusinessNetworkCanvas nodes={data.nodes} links={data.links} visibleKinds={visibleKinds} selectedId={selectedNode?.id} onSelect={setSelected} />
              : <div className="absolute inset-0 grid place-items-center text-center"><div><CircleDot size={26} className="mx-auto text-slate-600" /><p className="mt-3 text-sm text-slate-300">Your network is waiting for its first records</p><p className="mt-1 text-xs text-slate-500">Create contacts, leads, deals or products to populate the 3D view.</p></div></div>}
            <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 rounded-lg border border-white/[0.07] bg-[#0a1020]/80 px-3 py-2 text-[9px] text-slate-400 backdrop-blur"><Maximize2 size={11} /> Drag to rotate · Select a node to inspect</div>
            {selectedNode && <div className="absolute right-3 top-3 w-[min(260px,calc(100%-24px))] rounded-xl border border-indigo-200/15 bg-[#101a2e]/95 p-3 shadow-2xl backdrop-blur-xl"><div className="flex items-start justify-between gap-2"><div><p className="text-[9px] uppercase tracking-widest text-indigo-300">{selectedNode.kind}</p><p className="mt-1 text-sm font-semibold text-white">{selectedNode.label}</p></div><button onClick={() => setSelected(null)} aria-label="Close selected object" className="rounded p-1 text-slate-500 hover:bg-white/10 hover:text-white"><X size={13} /></button></div><p className="mt-1 text-[11px] text-slate-400">{selectedNode.detail || 'Business record'}</p>{selectedNode.value != null && <p className="mt-2 text-sm font-semibold text-white">{money(selectedNode.value, selectedNode.currency ?? 'INR')}</p>}{selectedNode.score != null && <p className="mt-1 text-[10px] text-slate-400">Lead score · {selectedNode.score}</p>}{selectedNode.stock != null && <p className="mt-1 text-[10px] text-slate-400">Stock · {selectedNode.stock}</p>}<Link href={hrefFor(selectedNode)} className="mt-3 flex items-center justify-between rounded-lg bg-indigo-500/15 px-3 py-2 text-[10px] font-medium text-indigo-200 hover:bg-indigo-500/25">Open CRM record <ExternalLink size={11} /></Link></div>}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] px-4 py-3">{FILTERS.map((filter) => { const active = visibleKinds.includes(filter.id); return <button key={filter.id} onClick={() => toggleKind(filter.id)} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] transition ${active ? 'border-white/15 bg-white/[0.07] text-slate-200' : 'border-white/[0.05] bg-transparent text-slate-600'}`}><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: filter.color, opacity: active ? 1 : 0.3 }} />{filter.label}</button>; })}<span className="ml-auto text-[9px] text-slate-600">Lines show CRM relationships</span></div>
        </section>

        <aside className="space-y-4">
          {showActivity && <section className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><Activity size={14} className="text-sky-300" /><h2 className="text-xs font-semibold text-slate-200">Live activity</h2></div><span className="text-[9px] text-slate-500">Latest events</span></div><div className="space-y-3">{(data?.activity ?? []).slice(0, 9).map((item) => <div key={item.id} className="flex gap-2.5"><span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${item.kind === 'ai' ? 'bg-sky-300' : item.kind === 'workflow' ? 'bg-violet-300' : 'bg-teal-300'}`} /><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-medium text-slate-200">{item.title}</p><p className="mt-0.5 truncate text-[9px] text-slate-500">{item.detail || item.status || 'Activity recorded'}</p></div><span className="shrink-0 text-[9px] text-slate-600">{timeAgo(item.at)}</span></div>)}{!data?.activity.length && <p className="py-5 text-center text-[10px] text-slate-500">No recent activity recorded.</p>}</div></section>}
          <section className="rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><Bot size={14} className="text-pink-300" /><h2 className="text-xs font-semibold text-slate-200">Team presence</h2></div><span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] text-slate-400">{data?.agents.length ?? 0} members</span></div><div className="space-y-3">{(data?.agents ?? []).map((agent) => <div key={agent.id} className="flex items-center gap-2.5"><div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-indigo-400/25 to-pink-400/20 text-[10px] font-semibold text-indigo-100">{agent.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-medium text-slate-200">{agent.name}</p><p className="text-[9px] text-slate-500">{agent.role.replaceAll('_', ' ')}</p></div><span className="text-[9px] text-slate-600">{timeAgo(agent.lastLoginAt)}</span></div>)}{!data?.agents.length && <p className="py-3 text-center text-[10px] text-slate-500">No active team members found.</p>}</div><Link href="/agents" className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3 text-[10px] text-indigo-300 hover:text-indigo-200">Open AI workforce <ExternalLink size={11} /></Link></section>
          <section className="rounded-2xl border border-indigo-300/10 bg-indigo-400/[0.06] p-4"><div className="flex items-center gap-2"><Workflow size={14} className="text-indigo-300" /><h2 className="text-xs font-semibold text-slate-200">Automation layer</h2></div><p className="mt-2 text-[10px] leading-5 text-slate-400">Workflow executions and AI-generated replies appear in the activity stream as they are recorded by the CRM.</p><Link href="/workflows" className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-medium text-indigo-300 hover:text-indigo-200">Manage workflows <ExternalLink size={11} /></Link></section>
        </aside>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[9px] text-slate-600"><span>Company-scoped CRM records · No demo objects are injected</span><span>Snapshot updated {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '—'}</span></div>
    </div>
  );
}

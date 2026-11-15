'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Send, CheckCheck, Bot, UserRound, MessageCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api-client';

type Conversation = {
  id: string; status: string; aiEnabled: boolean; unreadCount: number;
  lastMessageText?: string; lastMessageAt?: string;
  contact: { id: string; displayName?: string; phoneNumber: string; avatarUrl?: string };
  assignedAgent?: { id: string; firstName: string; lastName: string };
};
type Message = { id: string; direction: 'INBOUND' | 'OUTBOUND'; body?: string; type: string; status: string; isAiGenerated: boolean; createdAt: string };

export default function InboxPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [activeId, setActiveId] = useState('');
  const [draft, setDraft] = useState('');

  const conversationsQuery = useQuery({
    queryKey: ['inbox-conversations', status, search],
    queryFn: async () => (await api.get('/conversations', { params: { status: status || undefined, search: search || undefined, limit: 100 } })).data.data as { items: Conversation[]; total: number },
    refetchInterval: 5000,
  });
  const conversations = conversationsQuery.data?.items ?? [];
  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];
  const conversationId = active?.id ?? '';

  const templatesQuery = useQuery({
    queryKey: ['inbox-active-templates'],
    queryFn: async () => {
      try {
        const res = await api.get('/templates', { params: { status: 'ACTIVE', limit: 100 } });
        return (res.data.data?.items ?? []) as { id: string; name: string; body: string }[];
      } catch { return []; }
    },
    staleTime: 60_000,
  });

  const messagesQuery = useQuery({
    queryKey: ['inbox-messages', conversationId],
    enabled: !!conversationId,
    queryFn: async () => (await api.get(`/conversations/${conversationId}/messages`, { params: { limit: 100 } })).data.data as Message[],
    refetchInterval: 4000,
  });
  const messages = useMemo(() => [...(messagesQuery.data ?? [])].reverse(), [messagesQuery.data]);
  useEffect(() => { if (conversationId && active?.unreadCount) { void api.post(`/conversations/${conversationId}/read`).then(() => qc.invalidateQueries({ queryKey: ['inbox-conversations'] })).catch(() => undefined); } }, [conversationId, active?.unreadCount, qc]);

  const sendMutation = useMutation({
    mutationFn: async () => api.post('/messages/send', { conversationId, text: draft.trim() }),
    onSuccess: () => { setDraft(''); void qc.invalidateQueries({ queryKey: ['inbox-messages', conversationId] }); void qc.invalidateQueries({ queryKey: ['inbox-conversations'] }); },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? 'Message could not be queued'),
  });
  const actionMutation = useMutation({
    mutationFn: ({ action, value }: { action: 'resolve' | 'toggle-ai'; value?: boolean }) =>
      action === 'resolve' ? api.post(`/conversations/${conversationId}/resolve`) : api.post(`/conversations/${conversationId}/toggle-ai`, { enabled: value }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['inbox-conversations'] }); toast.success('Conversation updated'); },
    onError: () => toast.error('Could not update conversation'),
  });

  return <div className="mx-auto flex h-[calc(100vh-7.5rem)] min-h-[560px] max-w-[1500px] flex-col gap-4 p-4 lg:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-indigo-500">Customer communication</p><h1 className="mt-1 text-2xl font-semibold text-gray-950">WhatsApp Inbox</h1><p className="mt-1 text-sm text-gray-500">Shared customer conversations, live message history and human handoff.</p></div>
      <button onClick={() => { void conversationsQuery.refetch(); void messagesQuery.refetch(); }} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"><RefreshCw size={15}/> Refresh</button>
    </div>
    <div className="grid min-h-0 flex-1 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="flex min-h-0 flex-col border-b border-gray-200 lg:border-b-0 lg:border-r">
        <div className="space-y-3 border-b border-gray-100 p-4">
          <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone or message" className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-400"/></div>
          <div className="flex gap-1 rounded-xl bg-gray-100 p-1">{[['','All'],['OPEN','Open'],['WAITING_HUMAN','Needs reply'],['RESOLVED','Resolved']].map(([v,l]) => <button key={v} onClick={() => setStatus(v)} className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium ${status===v?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:text-gray-800'}`}>{l}</button>)}</div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {conversationsQuery.isLoading ? <div className="p-6 text-sm text-gray-400">Loading conversations…</div> : conversations.length ? conversations.map((c) => <button key={c.id} onClick={() => setActiveId(c.id)} className={`flex w-full items-start gap-3 border-b border-gray-50 px-4 py-4 text-left hover:bg-gray-50 ${active?.id===c.id?'bg-indigo-50/70':''}`}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">{(c.contact.displayName || c.contact.phoneNumber).slice(0,1).toUpperCase()}</div>
            <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-semibold text-gray-900">{c.contact.displayName || c.contact.phoneNumber}</p><span className="shrink-0 text-[10px] text-gray-400">{c.lastMessageAt?new Date(c.lastMessageAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):''}</span></div><p className="mt-1 truncate text-xs text-gray-500">{c.lastMessageText || 'No messages yet'}</p><div className="mt-2 flex items-center gap-2">{c.aiEnabled?<span className="inline-flex items-center gap-1 text-[10px] text-violet-600"><Bot size={11}/> AI active</span>:<span className="inline-flex items-center gap-1 text-[10px] text-gray-400"><UserRound size={11}/> Human</span>}{c.unreadCount>0&&<span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">{c.unreadCount}</span>}</div></div>
          </button>) : <div className="p-8 text-center"><MessageCircle className="mx-auto mb-2 text-gray-300"/><p className="text-sm font-medium text-gray-700">No conversations found</p><p className="mt-1 text-xs text-gray-400">Incoming WhatsApp messages will appear here.</p></div>}
        </div>
      </aside>
      <section className="flex min-h-0 flex-col bg-[#f8fafc]">
        {active ? <>
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-5 py-3"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">{(active.contact.displayName || active.contact.phoneNumber).slice(0,1).toUpperCase()}</div><div><p className="text-sm font-semibold text-gray-900">{active.contact.displayName || active.contact.phoneNumber}</p><p className="text-xs text-gray-500">{active.contact.phoneNumber}</p></div></div><div className="flex items-center gap-2"><button onClick={() => actionMutation.mutate({action:'toggle-ai',value:!active.aiEnabled})} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">{active.aiEnabled?'Pause AI':'Enable AI'}</button><button onClick={() => actionMutation.mutate({action:'resolve'})} disabled={active.status==='RESOLVED'} className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-40"><CheckCheck size={13}/> Resolve</button></div></header>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">{messagesQuery.isLoading?<p className="text-center text-sm text-gray-400">Loading messages…</p>:messages.length?messages.map((m)=><div key={m.id} className={`flex ${m.direction==='OUTBOUND'?'justify-end':'justify-start'}`}><div className={`max-w-[78%] rounded-2xl px-4 py-2.5 shadow-sm ${m.direction==='OUTBOUND'?'rounded-br-md bg-indigo-600 text-white':'rounded-bl-md border border-gray-200 bg-white text-gray-800'}`}><p className="whitespace-pre-wrap break-words text-sm">{m.body || `[${m.type.toLowerCase()} message]`}</p><div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${m.direction==='OUTBOUND'?'text-indigo-100':'text-gray-400'}`}>{m.isAiGenerated&&<span>AI ·</span>}<span>{new Date(m.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>{m.direction==='OUTBOUND'&&<span>· {m.status.toLowerCase()}</span>}</div></div></div>):<div className="py-16 text-center text-sm text-gray-400">No messages in this conversation yet.</div>}</div>
          <form onSubmit={(e)=>{e.preventDefault();if(draft.trim()&&!sendMutation.isPending)sendMutation.mutate();}} className="border-t border-gray-200 bg-white p-4"><div className="mb-2 flex items-center justify-between"><label className="text-[11px] font-medium text-gray-500">Message composer</label><select aria-label="Insert approved template" value="" onChange={(e)=>{const t=templatesQuery.data?.find(x=>x.id===e.target.value);if(t)setDraft(t.body);}} className="max-w-[190px] rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[11px] text-gray-600"><option value="">Insert template…</option>{(templatesQuery.data??[]).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div><div className="flex items-end gap-2"><textarea value={draft} onChange={(e)=>setDraft(e.target.value)} onKeyDown={(e)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(draft.trim()&&!sendMutation.isPending)sendMutation.mutate();}}} rows={2} placeholder="Write a WhatsApp message…" className="min-h-[48px] flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm outline-none focus:border-indigo-400"/><button type="submit" disabled={!draft.trim()||sendMutation.isPending} className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"><Send size={15}/> Send</button></div><p className="mt-2 text-[10px] text-gray-400">Enter to send · Shift + Enter for a new line · Messages are sent through the connected WhatsApp account.</p></form>
        </>:<div className="flex flex-1 flex-col items-center justify-center text-center"><MessageCircle size={36} className="mb-3 text-gray-300"/><p className="text-sm font-semibold text-gray-700">Select a conversation</p><p className="mt-1 text-xs text-gray-400">Choose a customer from the inbox to view the conversation.</p></div>}
      </section>
    </div>
  </div>;
}

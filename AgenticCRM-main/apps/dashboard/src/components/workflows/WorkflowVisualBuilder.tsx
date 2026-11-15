'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, Bot, CheckCircle2, Clock3, GitBranch, Plus, Save, ShieldCheck, Trash2, Zap } from 'lucide-react';
import { toast } from 'sonner';

type NodeKind = 'condition' | 'action' | 'ai_agent' | 'approval' | 'wait';
type WorkflowNode = { id: string; type: NodeKind; name: string; config: Record<string, unknown> };
type Trigger = { type: string; schedule?: string; timezone?: string; conditions?: Record<string, unknown> };

const triggers = [
  ['MANUAL', 'Manual run'], ['CONTACT_CREATED', 'Contact created'], ['CONTACT_UPDATED', 'Contact updated'],
  ['CONTACT_TAG_ADDED', 'Contact tag added'], ['LEAD_CREATED', 'Lead created'], ['LEAD_STATUS_CHANGED', 'Lead status changed'],
  ['DEAL_STAGE_CHANGED', 'Deal stage changed'], ['TICKET_CREATED', 'Ticket created'], ['FORM_SUBMITTED', 'Form submitted'],
  ['PAYMENT_RECEIVED', 'Payment received'], ['SCHEDULED', 'Scheduled'], ['WEBHOOK_RECEIVED', 'Webhook received'],
] as const;
const nodeTypes: { type: NodeKind; label: string; description: string; icon: typeof Zap }[] = [
  { type: 'condition', label: 'Condition', description: 'Branch when a field matches a value', icon: GitBranch },
  { type: 'action', label: 'Action', description: 'Perform a CRM operation', icon: Zap },
  { type: 'ai_agent', label: 'AI agent', description: 'Prepare an AI-assisted task', icon: Bot },
  { type: 'approval', label: 'Human approval', description: 'Pause for a human decision', icon: ShieldCheck },
  { type: 'wait', label: 'Wait / delay', description: 'Add a time delay', icon: Clock3 },
];
const actionTypes = [
  ['add_tag', 'Add contact tag'], ['remove_tag', 'Remove contact tag'], ['create_task', 'Create task'],
  ['send_message', 'Send WhatsApp message'], ['update_lead_status', 'Update lead status'],
  ['create_note', 'Add note'], ['webhook', 'Call webhook'],
];
const uid = () => `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function normaliseSteps(raw: unknown[]): WorkflowNode[] {
  return raw.map((item, index) => {
    const step = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const kind = (['condition', 'action', 'ai_agent', 'approval', 'wait'].includes(String(step.type)) ? step.type : 'action') as NodeKind;
    return { id: String(step.id ?? uid()), type: kind, name: String(step.name ?? `${kind.replace('_', ' ')} ${index + 1}`), config: (step.config && typeof step.config === 'object' ? step.config : {}) as Record<string, unknown> };
  });
}

export default function WorkflowVisualBuilder({ initialTrigger, initialSteps, onSave, saving, readOnly }: {
  initialTrigger?: Record<string, unknown>; initialSteps?: unknown[];
  onSave: (trigger: Trigger, steps: WorkflowNode[]) => void; saving?: boolean; readOnly?: boolean;
}) {
  const [trigger, setTrigger] = useState<Trigger>(() => ({ type: String(initialTrigger?.type ?? 'MANUAL'), schedule: String(initialTrigger?.schedule ?? '0 9 * * 1-5'), timezone: String(initialTrigger?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC'), conditions: (initialTrigger?.conditions as Record<string, unknown>) ?? {} }));
  const [nodes, setNodes] = useState<WorkflowNode[]>(() => normaliseSteps(initialSteps ?? []));
  const [selected, setSelected] = useState<string>('');
  const [showPalette, setShowPalette] = useState(false);
  const selectedNode = nodes.find((n) => n.id === selected);
  const validation = useMemo(() => {
    const issues: string[] = [];
    if (!trigger.type) issues.push('Choose a trigger.');
    if (trigger.type === 'SCHEDULED' && !trigger.schedule?.trim()) issues.push('A schedule expression is required.');
    nodes.forEach((node, i) => {
      if (node.type === 'action' && !node.config.action) issues.push(`Step ${i + 1}: choose an action.`);
      if (node.type === 'condition' && !node.config.field) issues.push(`Step ${i + 1}: set the field to evaluate.`);
      if (node.type === 'wait' && !(Number(node.config.minutes) > 0)) issues.push(`Step ${i + 1}: delay must be greater than zero minutes.`);
      if (node.type === 'approval' && !String(node.config.approver ?? '').trim()) issues.push(`Step ${i + 1}: specify an approval role or user.`);
    });
    return issues;
  }, [trigger, nodes]);

  useEffect(() => { if (selected && !nodes.some((n) => n.id === selected)) setSelected(''); }, [nodes, selected]);

  function addNode(type: NodeKind) {
    const meta = nodeTypes.find((n) => n.type === type)!;
    const node: WorkflowNode = { id: uid(), type, name: meta.label, config: type === 'action' ? { action: 'add_tag', tagName: '' } : type === 'condition' ? { field: '', operator: 'equals', value: '' } : type === 'wait' ? { minutes: 15 } : type === 'approval' ? { approver: 'admin', message: 'Please review this workflow step' } : { task: 'Review this customer context', instructions: '' } };
    setNodes((current) => [...current, node]); setSelected(node.id); setShowPalette(false);
  }
  function updateNode(patch: Partial<WorkflowNode>) { setNodes((current) => current.map((n) => n.id === selected ? { ...n, ...patch } : n)); }
  function updateConfig(key: string, value: unknown) { if (selectedNode) updateNode({ config: { ...selectedNode.config, [key]: value } }); }
  function move(index: number, delta: number) { const target = index + delta; if (target < 0 || target >= nodes.length) return; setNodes((current) => { const copy = [...current]; [copy[index], copy[target]] = [copy[target], copy[index]]; return copy; }); }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-sm font-semibold text-gray-900">Visual workflow builder</h2><p className="text-[11px] text-gray-500">Configure the trigger, connect steps in order, and save as a workflow definition.</p></div><button onClick={() => { if (validation.length) { toast.error(validation[0]); return; } onSave(trigger, nodes); }} disabled={saving || readOnly || validation.length > 0} className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-2 text-xs font-medium text-white disabled:opacity-40"><Save size={13}/>{saving ? 'Saving…' : 'Save workflow'}</button></div>
    <section className="rounded-xl border border-violet-200 bg-violet-50/50 p-3"><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-violet-900"><Zap size={14}/> Trigger</div><div className="grid gap-2 sm:grid-cols-2"><label className="text-[11px] text-gray-600">When should this workflow start?<select disabled={readOnly} value={trigger.type} onChange={(e) => setTrigger((v) => ({ ...v, type: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-xs">{triggers.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{trigger.type === 'SCHEDULED' && <><label className="text-[11px] text-gray-600">Cron schedule<input disabled={readOnly} value={trigger.schedule ?? ''} onChange={(e) => setTrigger((v) => ({ ...v, schedule: e.target.value }))} placeholder="0 9 * * 1-5" className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-xs"/></label><label className="text-[11px] text-gray-600">Timezone<input disabled={readOnly} value={trigger.timezone ?? 'UTC'} onChange={(e) => setTrigger((v) => ({ ...v, timezone: e.target.value }))} className="mt-1 w-full rounded-md border border-gray-200 bg-white px-2.5 py-2 text-xs"/></label></>}</div><p className="mt-2 text-[10px] text-violet-700">Scheduled triggers are stored as configuration. A scheduler/trigger dispatcher must be enabled in the runtime to execute them automatically.</p></section>
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
      <section className="min-w-0 rounded-xl border border-gray-200 bg-gray-50 p-3"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold text-gray-700">Workflow sequence</span><span className="text-[10px] text-gray-400">{nodes.length} steps</span></div><div className="mx-auto max-w-xl space-y-0">{nodes.length === 0 && <div className="rounded-lg border border-dashed border-gray-300 bg-white p-7 text-center"><Zap className="mx-auto mb-2 text-gray-300" size={22}/><p className="text-xs text-gray-600">Start by adding your first step</p></div>}{nodes.map((node, index) => { const meta = nodeTypes.find((n) => n.type === node.type)!; const Icon = meta.icon; return <div key={node.id} className="flex flex-col items-center"><button onClick={() => setSelected(node.id)} className={`w-full rounded-lg border bg-white p-3 text-left shadow-sm transition ${selected === node.id ? 'border-violet-400 ring-2 ring-violet-100' : 'border-gray-200 hover:border-gray-300'}`}><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-gray-700"><Icon size={14}/></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-gray-800">{node.name || meta.label}</span><span className="block text-[10px] text-gray-400">{meta.description}</span></span><span className="text-[10px] text-gray-400">#{index + 1}</span></div><p className="mt-2 truncate text-[10px] text-gray-500">{node.type === 'action' ? String(node.config.action ?? 'Action not configured') : node.type === 'condition' ? `${node.config.field || 'Choose field'} ${node.config.operator ?? ''} ${node.config.value ?? ''}` : node.type === 'wait' ? `Wait ${node.config.minutes ?? '?'} minutes` : node.type === 'approval' ? `Approval: ${node.config.approver ?? 'Not assigned'}` : String(node.config.task ?? 'AI task')}</p></button><div className="flex h-8 items-center"><span className="h-8 w-px bg-gray-300"/></div></div>; })}<button onClick={() => setShowPalette((v) => !v)} disabled={readOnly} className="mx-auto flex items-center gap-1.5 rounded-full border border-dashed border-gray-300 bg-white px-3 py-2 text-[11px] font-medium text-gray-600 hover:border-violet-400 disabled:opacity-40"><Plus size={13}/> Add step</button>{showPalette && <div className="mt-2 grid gap-2 sm:grid-cols-2">{nodeTypes.map((item) => { const Icon = item.icon; return <button key={item.type} onClick={() => addNode(item.type)} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 text-left hover:border-violet-300"><Icon size={15}/><span><span className="block text-[11px] font-semibold text-gray-700">{item.label}</span><span className="block text-[9px] text-gray-400">{item.description}</span></span></button>; })}</div>}</div></section>
      <aside className="space-y-3"><section className="rounded-xl border border-gray-200 bg-white p-3"><h3 className="mb-3 text-xs font-semibold text-gray-800">Step settings</h3>{!selectedNode ? <p className="text-[11px] text-gray-400">Select a step to configure it.</p> : <div className="space-y-2"><label className="block text-[10px] text-gray-500">Step name<input disabled={readOnly} value={selectedNode.name} onChange={(e) => updateNode({ name: e.target.value })} className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5 text-xs"/></label>{selectedNode.type === 'action' && <><label className="block text-[10px] text-gray-500">Action<select disabled={readOnly} value={String(selectedNode.config.action ?? '')} onChange={(e) => updateConfig('action', e.target.value)} className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5 text-xs">{actionTypes.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label><label className="block text-[10px] text-gray-500">Tag / message / task details<input disabled={readOnly} value={String(selectedNode.config.tagName ?? selectedNode.config.message ?? selectedNode.config.title ?? '')} onChange={(e) => updateConfig(selectedNode.config.action === 'send_message' ? 'message' : selectedNode.config.action === 'create_task' ? 'title' : 'tagName', e.target.value)} className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5 text-xs"/></label></>}{selectedNode.type === 'condition' && <>{[['field','Field'],['operator','Operator'],['value','Compare value']].map(([key,label]) => <label key={key} className="block text-[10px] text-gray-500">{label}<input disabled={readOnly} value={String(selectedNode.config[key] ?? '')} onChange={(e) => updateConfig(key,e.target.value)} className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5 text-xs"/></label>)}</>}{selectedNode.type === 'wait' && <label className="block text-[10px] text-gray-500">Delay in minutes<input type="number" min="1" disabled={readOnly} value={String(selectedNode.config.minutes ?? 15)} onChange={(e) => updateConfig('minutes', Number(e.target.value))} className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5 text-xs"/></label>}{selectedNode.type === 'approval' && <label className="block text-[10px] text-gray-500">Approver role / user<input disabled={readOnly} value={String(selectedNode.config.approver ?? '')} onChange={(e) => updateConfig('approver',e.target.value)} className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5 text-xs"/></label>}{selectedNode.type === 'ai_agent' && <><label className="block text-[10px] text-gray-500">AI task<input disabled={readOnly} value={String(selectedNode.config.task ?? '')} onChange={(e) => updateConfig('task',e.target.value)} className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5 text-xs"/></label><label className="block text-[10px] text-gray-500">Instructions<textarea disabled={readOnly} value={String(selectedNode.config.instructions ?? '')} onChange={(e) => updateConfig('instructions',e.target.value)} rows={3} className="mt-1 w-full rounded border border-gray-200 px-2 py-1.5 text-xs"/></label></>}
      {!readOnly && <div className="flex items-center gap-1 border-t border-gray-100 pt-2"><button onClick={() => move(nodes.findIndex((n) => n.id === selected),-1)} className="rounded border border-gray-200 p-1.5 text-gray-500" title="Move up"><ArrowUp size={12}/></button><button onClick={() => move(nodes.findIndex((n) => n.id === selected),1)} className="rounded border border-gray-200 p-1.5 text-gray-500" title="Move down"><ArrowDown size={12}/></button><button onClick={() => setNodes((v) => v.filter((n) => n.id !== selected))} className="ml-auto rounded border border-red-100 p-1.5 text-red-500" title="Delete step"><Trash2 size={12}/></button></div>}</div>}</section>
      <section className="rounded-xl border border-gray-200 bg-white p-3"><h3 className="mb-2 text-xs font-semibold text-gray-800">Validation</h3>{validation.length ? <ul className="space-y-1">{validation.map((issue) => <li key={issue} className="flex gap-1.5 text-[10px] text-amber-700"><AlertTriangle size={12} className="shrink-0"/>{issue}</li>)}</ul> : <p className="flex items-center gap-1.5 text-[10px] text-emerald-700"><CheckCircle2 size={12}/> No configuration issues found.</p>}</section></aside>
    </div>
    <p className="text-[10px] text-gray-400">Builder note: the execution engine supports payload-based conditions, selected CRM actions, approval checkpoints and persisted delay checkpoints. AI-agent, messaging, webhook and scheduled/event-trigger execution still require additional runtime handlers.</p>
  </div>;
}

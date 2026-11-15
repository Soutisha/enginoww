'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api-client';
import { toast } from 'sonner';
import { Building2, Database, FlaskConical, Loader2, ShieldCheck, Trash2 } from 'lucide-react';

type DemoCounts = {
  contacts: number;
  leads: number;
  deals: number;
  tasks: number;
  products: number;
  payments: number;
  conversations: number;
};

type DemoDataStatus = {
  loaded: boolean;
  counts: DemoCounts;
  note: string;
};

export default function CompanySettingsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const res = await api.get<{ data: { name: string; email?: string; phone?: string; website?: string; timezone?: string } }>('/company');
      return res.data.data;
    },
  });

  useEffect(() => {
    if (company) {
      setName(company.name ?? '');
      setEmail(company.email ?? '');
      setPhone(company.phone ?? '');
      setWebsite(company.website ?? '');
      setTimezone(company.timezone ?? 'Asia/Kolkata');
    }
  }, [company]);

  const saveMutation = useMutation({
    mutationFn: () => api.patch('/company', { name, email, phone, website, timezone }),
    onSuccess: () => toast.success('Company settings saved'),
    onError: () => toast.error('Failed to save settings'),
  });

  const { data: demoStatus, isLoading: demoStatusLoading } = useQuery<DemoDataStatus>({
    queryKey: ['company-demo-data'],
    queryFn: async () => {
      const res = await api.get<{ data: DemoDataStatus }>('/company/demo-data');
      return res.data.data;
    },
  });

  const loadDemoMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ data: DemoDataStatus & { message: string } }>('/company/demo-data/load');
      return res.data.data;
    },
    onSuccess: async (result) => {
      toast.success(result.message);
      await queryClient.invalidateQueries();
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Could not load demo data. Please retry.';
      toast.error(message);
    },
  });

  const clearDemoMutation = useMutation({
    mutationFn: async () => {
      const res = await api.delete<{ data: DemoDataStatus & { message: string } }>('/company/demo-data', {
        data: { confirmation: 'DELETE_DEMO_DATA' },
      });
      return res.data.data;
    },
    onSuccess: async (result) => {
      toast.success(result.message);
      await queryClient.invalidateQueries();
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Could not remove demo data. Please retry.';
      toast.error(message);
    },
  });

  const requestDemoCleanup = () => {
    const accepted = window.confirm(
      'Remove only the fictional BizPilot demo records created by this tool? Your real contacts, leads, deals and other business records will be kept. Cleanup stops if real records are linked to demo records.',
    );
    if (accepted) clearDemoMutation.mutate();
  };

  const timezones = (() => {
    try {
      if (typeof Intl !== 'undefined' && Intl.supportedValuesOf) {
        return Intl.supportedValuesOf('timeZone');
      }
    } catch { /* fallback */ }
    return [
      'UTC', 'Asia/Kolkata', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Singapore', 'Asia/Tokyo',
      'Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Seoul', 'Asia/Jakarta', 'Asia/Dhaka',
      'Asia/Karachi', 'Asia/Colombo', 'Asia/Kathmandu', 'Asia/Tehran', 'Asia/Baghdad',
      'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Moscow', 'Europe/Istanbul',
      'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
      'America/Toronto', 'America/Sao_Paulo', 'America/Mexico_City',
      'Africa/Cairo', 'Africa/Lagos', 'Africa/Johannesburg', 'Africa/Nairobi',
      'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland',
    ];
  })();

  const formatTzLabel = (tz: string) => {
    try {
      const offset = new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'shortOffset' })
        .formatToParts(new Date())
        .find((p) => p.type === 'timeZoneName')?.value ?? '';
      return `${tz.replace(/_/g, ' ')} (${offset})`;
    } catch {
      return tz;
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
          <Building2 size={20} className="text-gray-900" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Company Settings</h1>
          <p className="text-sm text-gray-500">Update your company profile</p>
        </div>
      </div>

      <section className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-white border border-amber-100 flex items-center justify-center shrink-0">
            <FlaskConical size={19} className="text-amber-700" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-amber-950">Demo workspace data</h2>
            <p className="text-xs text-amber-900 mt-1">
              Load fictional contacts, leads, deals, tasks, products, sample inbox conversations and simulated payments so the dashboard has data to demonstrate.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-amber-950">
          <ShieldCheck size={14} />
          <span>Workspace-scoped and tagged as demo. No WhatsApp messages are sent and no payment gateway is called.</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {([
            ['Contacts', demoStatus?.counts.contacts ?? 0],
            ['Leads', demoStatus?.counts.leads ?? 0],
            ['Deals', demoStatus?.counts.deals ?? 0],
            ['Tasks', demoStatus?.counts.tasks ?? 0],
            ['Products', demoStatus?.counts.products ?? 0],
            ['Conversations', demoStatus?.counts.conversations ?? 0],
            ['Simulated payments', demoStatus?.counts.payments ?? 0],
          ] as const).map(([label, value]) => (
            <div key={label} className="rounded-lg border border-amber-100 bg-white/80 px-3 py-2">
              <p className="text-[10px] text-gray-500">{label}</p>
              <p className="text-lg font-semibold text-gray-900 tabular-nums">{demoStatusLoading ? '—' : value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => loadDemoMutation.mutate()}
            disabled={loadDemoMutation.isPending || demoStatusLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {loadDemoMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
            {loadDemoMutation.isPending ? 'Loading sample data…' : demoStatus?.loaded ? 'Check / Load Demo Data' : 'Load Demo Data'}
          </button>
          {demoStatus?.loaded && (
            <button
              onClick={requestDemoCleanup}
              disabled={clearDemoMutation.isPending || loadDemoMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {clearDemoMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Remove Demo Data
            </button>
          )}
        </div>
        <p className="text-[10px] leading-relaxed text-amber-900">
          Demo payments are simulated only and must not be reported as real revenue. All sample records have a dedicated demo marker. Cleanup removes only marked demo records and refuses to proceed if real business records depend on them.
        </p>
      </section>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700">Company Name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Business Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Phone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Website</label>
          <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700">Timezone</label>
          <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400">
            {timezones.map((tz) => <option key={tz} value={tz}>{formatTzLabel(tz)}</option>)}
          </select>
        </div>
        <div className="pt-2">
          <button onClick={() => saveMutation.mutate()} disabled={!name || saveMutation.isPending} className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            {saveMutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

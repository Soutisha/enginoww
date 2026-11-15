'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BrainCircuit, AlertTriangle, RefreshCw, Info } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar } from 'recharts';
import api from '@/lib/api-client';

type PredictiveData = {
  generatedAt: string; currency: string; mixedCurrencies: boolean;
  dataCoverage: { months: number; paymentRecords: number; leadRecords: number; customers: number; wonLineItems: number };
  revenue: { history: { date: string; value: number }[]; forecast: { date: string; value: number }[]; confidence: string; rSquared: number | null; method: string };
  salesTrends: { date: string; leads: number; won: number; revenue: number }[];
  conversion: { history: { date: string; leads: number; won: number; conversionRate: number }[]; nextPeriodRate: number; method: string };
  customerSegmentation: { counts: { champions: number; loyal: number; atRisk: number; newCustomers: number; inactive: number }; customers: { id: string; name: string; segment: string; spend: number; orders: number; lastPurchaseAt: string | null }[]; definitions: Record<string, string> };
  productRecommendations: { name: string; units: number; revenue: number; rank: number; reason: string }[];
  anomalies: { date: string; value: number; zScore: number; direction: string; explanation: string }[];
  insights: { type: string; title: string; detail: string; evidence: string }[];
};

const money = (value: number, currency: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
const Panel = ({ title, children, subtitle }: { title: string; children: React.ReactNode; subtitle?: string }) => (
  <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="mb-3"><h2 className="text-sm font-semibold text-gray-900">{title}</h2>{subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}</div>
    {children}
  </section>
);

export default function PredictiveAnalyticsPage() {
  const query = useQuery<PredictiveData>({ queryKey: ['predictive-analytics'], queryFn: () => api.get('/analytics/predictive').then(r => r.data.data), staleTime: 60_000 });
  const data = query.data;
  if (query.isLoading) return <div className="space-y-4 p-6"><div className="h-8 w-64 animate-pulse rounded bg-gray-200" />{[1, 2, 3].map(i => <div key={i} className="h-52 animate-pulse rounded-xl bg-gray-100" />)}</div>;
  if (query.isError || !data) return <div className="p-6"><Link href="/analytics" className="mb-4 inline-flex items-center gap-2 text-sm text-gray-500"><ArrowLeft size={16}/> Analytics</Link><div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">Unable to load predictive analytics. Please check your connection and try again.<button onClick={() => query.refetch()} className="ml-3 underline">Retry</button></div></div>;

  const forecastChart = [...data.revenue.history.map(r => ({ date: r.date, actual: r.value, forecast: null as number | null })), ...(data.revenue.forecast.length ? [{ date: data.revenue.history[data.revenue.history.length - 1]?.date ?? data.revenue.forecast[0].date, actual: null as number | null, forecast: data.revenue.history[data.revenue.history.length - 1]?.value ?? 0 }, ...data.revenue.forecast.map(r => ({ date: r.date, actual: null as number | null, forecast: r.value }))] : [])];
  const segments = [
    { name: 'Champions', value: data.customerSegmentation.counts.champions },
    { name: 'Loyal', value: data.customerSegmentation.counts.loyal },
    { name: 'At risk', value: data.customerSegmentation.counts.atRisk },
    { name: 'New', value: data.customerSegmentation.counts.newCustomers },
    { name: 'Inactive', value: data.customerSegmentation.counts.inactive },
  ];

  return <div className="flex h-full flex-col overflow-y-auto bg-gray-50">
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
      <div><Link href="/analytics" className="mb-1 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900"><ArrowLeft size={13}/> Analytics</Link><h1 className="flex items-center gap-2 text-lg font-semibold text-gray-900"><BrainCircuit size={20}/> Predictive Business Analytics</h1><p className="text-xs text-gray-500">Forecasts and recommendations derived from your company’s CRM records</p></div>
      <button onClick={() => query.refetch()} className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-50" aria-label="Refresh"><RefreshCw size={15}/></button>
    </header>
    <main className="space-y-5 p-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs text-gray-500">Revenue forecast confidence</p><p className="mt-1 text-xl font-semibold capitalize text-gray-900">{data.revenue.confidence.replace('_', ' ')}</p><p className="mt-1 text-[11px] text-gray-400">Trend fit: {data.revenue.rSquared === null ? 'N/A' : `${Math.round(data.revenue.rSquared * 100)}%`}</p></div>
        <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs text-gray-500">Next cohort conversion outlook</p><p className="mt-1 text-xl font-semibold text-gray-900">{data.conversion.nextPeriodRate}%</p><p className="mt-1 text-[11px] text-gray-400">Recent completed cohorts</p></div>
        <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs text-gray-500">Customers at risk</p><p className="mt-1 text-xl font-semibold text-amber-600">{data.customerSegmentation.counts.atRisk}</p><p className="mt-1 text-[11px] text-gray-400">No purchase in over 90 days</p></div>
        <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-xs text-gray-500">Revenue anomalies</p><p className="mt-1 text-xl font-semibold text-gray-900">{data.anomalies.length}</p><p className="mt-1 text-[11px] text-gray-400">Monthly statistical outliers</p></div>
      </div>

      <Panel title="Revenue forecast" subtitle={`Historical monthly net paid revenue and next 3 months projection · ${data.currency} · ${data.revenue.confidence} confidence`}>
        <div className="h-72"><ResponsiveContainer width="100%" height="100%"><LineChart data={forecastChart} margin={{ top: 8, right: 12, left: 8, bottom: 4 }}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date" tick={{ fontSize: 10 }}/><YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${Math.round(v / 1000)}k`}/><Tooltip formatter={(v) => money(Number(v), data.currency)}/><Legend/><Line type="monotone" dataKey="actual" name="Actual revenue" stroke="#4f46e5" strokeWidth={2} dot={false} connectNulls/><Line type="monotone" dataKey="forecast" name="Forecast" stroke="#d97706" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls/></LineChart></ResponsiveContainer></div>
        <p className="mt-2 flex items-start gap-2 text-xs text-gray-500"><Info size={14} className="mt-0.5 shrink-0"/>{data.revenue.method} {data.mixedCurrencies && 'Multiple currencies exist; only the highest-volume currency is included, never summed across currencies.'}</p>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Sales trends" subtitle="Monthly lead creation, wins and collected revenue"><div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.salesTrends}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date" tick={{ fontSize: 10 }}/><YAxis yAxisId="left" tick={{ fontSize: 10 }}/><YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }}/><Tooltip/><Legend/><Line yAxisId="left" dataKey="leads" stroke="#6366f1"/><Line yAxisId="left" dataKey="won" stroke="#16a34a"/><Line yAxisId="right" dataKey="revenue" stroke="#d97706"/></LineChart></ResponsiveContainer></div></Panel>
        <Panel title="Customer segmentation" subtitle="RFM-style segments based on paid purchase recency, frequency and spend"><div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={segments} layout="vertical" margin={{ left: 12, right: 16 }}><CartesianGrid strokeDasharray="3 3"/><XAxis type="number" tick={{ fontSize: 10 }}/><YAxis type="category" dataKey="name" width={78} tick={{ fontSize: 10 }}/><Tooltip/><Bar dataKey="value" name="Customers" fill="#6366f1" radius={[0, 5, 5, 0]}/></BarChart></ResponsiveContainer></div><p className="mt-2 text-xs text-gray-500">Segments use recorded paid payments only. Contacts without purchase records are classified as inactive.</p></Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Product recommendations" subtitle="Best-performing products by revenue in won deals"><div className="space-y-3">{data.productRecommendations.length ? data.productRecommendations.map(p => <div key={`${p.rank}-${p.name}`} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0"><div className="flex min-w-0 items-center gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-xs font-semibold text-indigo-700">{p.rank}</span><div className="min-w-0"><p className="truncate text-sm font-medium text-gray-800">{p.name}</p><p className="text-[11px] text-gray-500">{p.units} units sold</p></div></div><p className="shrink-0 text-sm font-semibold text-gray-900">{money(p.revenue, data.currency)}</p></div>) : <p className="text-sm text-gray-500">No product line items are linked to won deals yet.</p>}</div></Panel>
        <Panel title="Anomaly detection" subtitle="Monthly revenue outside two standard deviations from the 12-month mean"><div className="space-y-3">{data.anomalies.length ? data.anomalies.map(a => <div key={a.date} className="flex gap-3 rounded-lg bg-amber-50 p-3"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600"/><div><p className="text-sm font-medium text-gray-900">{a.date} · {a.direction === 'above_expected' ? 'Unusually high' : 'Unusually low'} revenue</p><p className="text-xs text-gray-600">{money(a.value, data.currency)} · z-score {a.zScore}</p><p className="mt-1 text-xs text-gray-500">{a.explanation}</p></div></div>) : <p className="text-sm text-gray-500">No statistical outliers detected in the available monthly revenue history.</p>}</div></Panel>
      </div>

      <Panel title="Explainable business insights" subtitle="Rule-based observations tied to the data shown above"><div className="grid gap-3 md:grid-cols-2">{data.insights.length ? data.insights.map((item, i) => <div key={`${item.title}-${i}`} className="rounded-lg border border-gray-100 p-3"><p className="text-sm font-semibold text-gray-900">{item.title}</p><p className="mt-1 text-xs text-gray-600">{item.detail}</p><p className="mt-2 text-[11px] font-medium text-gray-500">Evidence: {item.evidence}</p></div>) : <p className="text-sm text-gray-500">No additional insights from the available records.</p>}</div></Panel>

      <Panel title="Data coverage and methodology"><div className="grid grid-cols-2 gap-3 text-xs text-gray-600 md:grid-cols-5"><div><p className="text-lg font-semibold text-gray-900">{data.dataCoverage.paymentRecords}</p>Paid payments</div><div><p className="text-lg font-semibold text-gray-900">{data.dataCoverage.leadRecords}</p>Leads</div><div><p className="text-lg font-semibold text-gray-900">{data.dataCoverage.customers}</p>Contacts</div><div><p className="text-lg font-semibold text-gray-900">{data.dataCoverage.wonLineItems}</p>Won deal line items</div><div><p className="text-lg font-semibold text-gray-900">{data.dataCoverage.months}/12</p>Months with revenue</div></div><p className="mt-3 text-xs text-gray-500">Forecasts are statistical estimates, not guarantees. Low data coverage, seasonality, one-off payments and changing business conditions can materially affect accuracy. Last calculated: {new Date(data.generatedAt).toLocaleString()}.</p></Panel>
    </main>
  </div>;
}

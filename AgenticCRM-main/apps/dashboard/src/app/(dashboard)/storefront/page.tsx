'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, Store, Save, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import api from '@/lib/api-client';

type Company = { name: string; slug: string; logoUrl?: string; website?: string; email?: string; phone?: string; storefrontEnabled: boolean; storefrontDescription?: string; storefrontBannerUrl?: string; storefrontAccentColor: string };
export default function StorefrontSettingsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['company-profile'], queryFn: async () => (await api.get('/company')).data.data as Company });
  const [form, setForm] = useState({ storefrontEnabled: false, storefrontDescription: '', storefrontBannerUrl: '', storefrontAccentColor: '#4f46e5' });
  useEffect(() => { if (data) setForm({ storefrontEnabled: data.storefrontEnabled, storefrontDescription: data.storefrontDescription || '', storefrontBannerUrl: data.storefrontBannerUrl || '', storefrontAccentColor: data.storefrontAccentColor || '#4f46e5' }); }, [data]);
  const save = useMutation({ mutationFn: () => api.patch('/company', form), onSuccess: () => { toast.success('Storefront settings saved'); void qc.invalidateQueries({ queryKey: ['company-profile'] }); }, onError: () => toast.error('Could not save storefront settings') });
  const url = typeof window !== 'undefined' && data ? `${window.location.origin}/store/${data.slug}` : '';
  if (isLoading) return <div className="p-8 text-sm text-gray-500">Loading storefront settings…</div>;
  return <div className="mx-auto max-w-5xl space-y-6 p-4 lg:p-6">
    <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-indigo-500">Commerce presence</p><h1 className="mt-1 text-2xl font-semibold text-gray-950">Brand & Storefront</h1><p className="mt-1 text-sm text-gray-500">Publish your active product catalogue as a public, shareable storefront.</p></div>
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"><div className="mb-5 flex items-center gap-3"><span className="rounded-xl bg-indigo-50 p-3 text-indigo-600"><Store size={20}/></span><div><h2 className="font-semibold text-gray-900">Store configuration</h2><p className="text-xs text-gray-500">Brand identity and publishing controls</p></div></div>
        <form onSubmit={e=>{e.preventDefault();save.mutate();}} className="space-y-4">
          <label className="flex items-center justify-between rounded-xl border border-gray-200 p-4"><span><span className="block text-sm font-semibold text-gray-900">Publish storefront</span><span className="mt-1 block text-xs text-gray-500">Allow anyone with the link to view active products and prices.</span></span><input type="checkbox" checked={form.storefrontEnabled} onChange={e=>setForm({...form,storefrontEnabled:e.target.checked})} className="h-5 w-5 accent-indigo-600"/></label>
          <label className="block text-xs font-medium text-gray-600">Store description<textarea rows={3} value={form.storefrontDescription} onChange={e=>setForm({...form,storefrontDescription:e.target.value})} placeholder="Tell customers what your business offers…" className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-indigo-400"/></label>
          <label className="block text-xs font-medium text-gray-600">Banner image URL<input value={form.storefrontBannerUrl} onChange={e=>setForm({...form,storefrontBannerUrl:e.target.value})} placeholder="https://example.com/banner.jpg" className="mt-1.5 w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-indigo-400"/></label>
          <label className="block text-xs font-medium text-gray-600">Brand accent colour<div className="mt-1.5 flex items-center gap-3"><input type="color" value={form.storefrontAccentColor} onChange={e=>setForm({...form,storefrontAccentColor:e.target.value})} className="h-10 w-14 cursor-pointer rounded-lg border border-gray-200 bg-white p-1"/><input value={form.storefrontAccentColor} onChange={e=>setForm({...form,storefrontAccentColor:e.target.value})} className="w-36 rounded-lg border border-gray-200 px-3 py-2.5 text-sm"/></div></label>
          <button disabled={save.isPending} className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50"><Save size={15}/>{save.isPending?'Saving…':'Save storefront settings'}</button>
        </form>
      </section>
      <aside className="space-y-4"><div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"><h3 className="font-semibold text-gray-900">Your public link</h3><p className="mt-1 text-xs text-gray-500">Share this URL with customers. It only works while publishing is enabled.</p><div className="mt-3 break-all rounded-lg bg-gray-50 p-3 text-xs text-gray-700">{url}</div><div className="mt-3 flex gap-2"><button onClick={()=>{if(url){void navigator.clipboard.writeText(url);toast.success('Link copied');}}} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700"><Copy size={13}/> Copy link</button><a href={url || '#'} target="_blank" rel="noreferrer" className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${form.storefrontEnabled?'bg-indigo-600 text-white':'pointer-events-none bg-gray-100 text-gray-400'}`}><ExternalLink size={13}/> Preview</a></div></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="text-sm font-semibold text-amber-900">Before publishing</p><ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-amber-800"><li>Set your company logo and contact details in Company Settings.</li><li>Activate the products you want customers to see.</li><li>Check prices, images, stock and descriptions.</li></ul></div></aside>
    </div>
  </div>;
}

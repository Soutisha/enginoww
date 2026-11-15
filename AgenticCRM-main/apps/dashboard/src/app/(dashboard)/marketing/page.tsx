'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/lib/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Sparkles, Megaphone, Copy, Download, Save, ShieldCheck, AlertTriangle, WandSparkles, RefreshCw,
} from 'lucide-react';

type MarketingType = 'product_description' | 'whatsapp_reply' | 'promotional_copy' | 'campaign' | 'social_post' | 'banner';
type Product = { id: string; name: string; description?: string | null; price: number; currency: string; sku?: string | null; category?: string | null; stock: number; trackInventory: boolean; tags: string[] };
type Brand = { brandName: string; tagline: string; voice: string; audience: string; valueProps: string[]; preferredTerms: string[]; avoidTerms: string[]; primaryColor: string; secondaryColor: string; ctaStyle: string; locale: string };
type Variant = { label: string; content: string; cta?: string; hashtags?: string[] };
type Result = { title: string; summary: string; variants: Variant[]; campaign?: { name: string; objective: string; audience: string; channel: string }; banner?: { headline: string; subheadline: string; cta: string; visualDirection: string; altText: string }; brandNotes?: string[]; disclaimers?: string[]; brandCheck?: { passed: boolean; avoidMatches: string[]; missingPreferred: string[]; issues: string[] } };
type Asset = { id: string; type: string; title: string; status: string; createdAt: string; provider: string; model: string };

const types: { value: MarketingType; label: string; hint: string }[] = [
  { value: 'product_description', label: 'Product description', hint: 'Accurate catalogue copy grounded in saved product facts.' },
  { value: 'whatsapp_reply', label: 'WhatsApp reply', hint: 'A customer-ready reply draft. Nothing is sent automatically.' },
  { value: 'promotional_copy', label: 'Promotional copy', hint: 'Offer-led copy without inventing discounts or claims.' },
  { value: 'campaign', label: 'Campaign concept', hint: 'Campaign objective, audience and message variations.' },
  { value: 'social_post', label: 'Social media content', hint: 'Platform-aware post variants, captions and hashtags.' },
  { value: 'banner', label: 'Marketing banner', hint: 'Copy plus a downloadable SVG banner layout.' },
];

const defaults: Brand = { brandName: '', tagline: '', voice: 'clear, helpful and confident', audience: '', valueProps: [], preferredTerms: [], avoidTerms: [], primaryColor: '#2563eb', secondaryColor: '#0f172a', ctaStyle: 'clear and action-oriented', locale: 'en-IN' };
const csvList = (s: string | string[]) => (Array.isArray(s) ? s : s.split(',')).map(x => x.trim()).filter(Boolean);
const xml = (s: string) => s.replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]!));

export default function MarketingStudioPage() {
  const qc = useQueryClient();
  const [type, setType] = useState<MarketingType>('product_description');
  const [productId, setProductId] = useState('');
  const [productName, setProductName] = useState('');
  const [audience, setAudience] = useState('');
  const [objective, setObjective] = useState('');
  const [offer, setOffer] = useState('');
  const [platform, setPlatform] = useState('Instagram');
  const [channel, setChannel] = useState('WHATSAPP');
  const [tone, setTone] = useState('');
  const [language, setLanguage] = useState('en-IN');
  const [context, setContext] = useState('');
  const [constraints, setConstraints] = useState('');
  const [variants, setVariants] = useState(3);
  const [result, setResult] = useState<Result | null>(null);
  const [assetId, setAssetId] = useState('');
  const [brand, setBrand] = useState<Brand>(defaults);
  const [brandOpen, setBrandOpen] = useState(false);
  const [historyId, setHistoryId] = useState('');

  const productsQ = useQuery({
    queryKey: ['marketing-products'],
    queryFn: async () => (await api.get<{data:{items:Product[]}}>('/products?limit=200&archived=false')).data.data.items,
  });
  const brandQ = useQuery({
    queryKey: ['marketing-brand-profile'],
    queryFn: async () => (await api.get<{data:Brand}>('/marketing/brand-profile')).data.data,
  });
  useEffect(() => { if (brandQ.data) setBrand({ ...defaults, ...brandQ.data }); }, [brandQ.data]);
  const assetsQ = useQuery({
    queryKey: ['marketing-assets'],
    queryFn: async () => (await api.get<{data:Asset[]}>('/marketing/assets?limit=30')).data.data,
  });
  const selectedProduct = useMemo(() => productsQ.data?.find(p => p.id === productId), [productsQ.data, productId]);

  const generate = useMutation({
    mutationFn: async () => {
      const payload = {
        type, productId: type === 'product_description' ? (productId || undefined) : undefined,
        productName: type === 'product_description' && !productId ? productName : undefined,
        audience: audience || undefined, objective: objective || undefined, offer: offer || undefined,
        platform: type === 'social_post' || type === 'banner' ? platform : undefined,
        channel: type === 'campaign' || type === 'promotional_copy' ? channel : undefined,
        tone: tone || undefined, language, context: context || undefined,
        constraints: constraints || undefined, variants, includeHashtags: true,
      };
      return (await api.post<{data:{asset:{id:string};result:Result;generation:{provider:string;model:string}}}>('/marketing/generate', payload)).data.data;
    },
    onSuccess: (data) => {
      setResult(data.result); setAssetId(data.asset.id); setHistoryId('');
      void qc.invalidateQueries({ queryKey: ['marketing-assets'] });
      toast.success('Marketing draft generated and saved');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Generation failed. Check Settings → AI.'),
  });
  const saveBrand = useMutation({
    mutationFn: async () => (await api.put('/marketing/brand-profile', {
      ...brand, valueProps: csvList(brand.valueProps),
      preferredTerms: csvList(brand.preferredTerms),
      avoidTerms: csvList(brand.avoidTerms),
    })).data,
    onSuccess: () => { void qc.invalidateQueries({queryKey:['marketing-brand-profile']}); toast.success('Brand profile saved'); },
    onError: () => toast.error('Could not save brand profile'),
  });
  const applyDescription = useMutation({
    mutationFn: async (description: string) => {
      if (!productId) throw new Error('Choose a catalogue product first');
      return api.patch(`/products/${productId}`, { description });
    },
    onSuccess: () => { void qc.invalidateQueries({queryKey:['products']}); void qc.invalidateQueries({queryKey:['marketing-products']}); toast.success('Product description updated'); },
    onError: () => toast.error('Could not update product description'),
  });

  const setBrandText = (key: keyof Brand, value: string) => setBrand(prev => ({ ...prev, [key]: value as never }));
  const copy = async (text: string) => { await navigator.clipboard.writeText(text); toast.success('Copied to clipboard'); };
  const loadAsset = async (id: string) => {
    try {
      const data = (await api.get<{data:{id:string;result:Result}}>('/marketing/assets/'+id)).data.data;
      setResult(data.result); setAssetId(id); setHistoryId(id);
    } catch { toast.error('Could not load saved draft'); }
  };
  const downloadBanner = () => {
    if (!result?.banner) return;
    const b = result.banner, primary = /^#[0-9a-f]{6}$/i.test(brand.primaryColor) ? brand.primaryColor : '#2563eb';
    const secondary = /^#[0-9a-f]{6}$/i.test(brand.secondaryColor) ? brand.secondaryColor : '#0f172a';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${primary}"/><stop offset="1" stop-color="${secondary}"/></linearGradient></defs><rect width="1200" height="630" rx="32" fill="url(#g)"/><circle cx="1050" cy="80" r="240" fill="#ffffff" opacity=".08"/><circle cx="950" cy="610" r="300" fill="#ffffff" opacity=".06"/><text x="82" y="112" fill="#ffffff" opacity=".78" font-family="Arial,sans-serif" font-size="26" font-weight="700">${xml(brand.brandName || 'YOUR BRAND')}</text><text x="82" y="285" fill="#ffffff" font-family="Arial,sans-serif" font-size="66" font-weight="800">${xml(b.headline)}</text><foreignObject x="82" y="325" width="850" height="110"><div xmlns="http://www.w3.org/1999/xhtml" style="color:white;font:28px Arial,sans-serif;opacity:.9">${xml(b.subheadline)}</div></foreignObject><rect x="82" y="490" width="290" height="72" rx="14" fill="#ffffff"/><text x="227" y="536" text-anchor="middle" fill="${secondary}" font-family="Arial,sans-serif" font-size="24" font-weight="700">${xml(b.cta)}</text></svg>`;
    const url = URL.createObjectURL(new Blob([svg], {type:'image/svg+xml'}));
    const a = document.createElement('a'); a.href = url; a.download = 'bizpilot-marketing-banner.svg'; a.click(); URL.revokeObjectURL(url);
  };

  const createCampaignDraft = async () => {
    if (!result) return;
    try {
      await api.post('/campaigns', {
        name: result.campaign?.name || result.title,
        description: result.summary,
        channel: channel === 'EMAIL' || channel === 'SMS' ? channel : 'WHATSAPP',
        sendMode: 'DIRECT', priority: 'MEDIUM',
        notes: result.variants.map(v => `${v.label}\n${v.content}`).join('\n\n'),
        tags: ['ai-generated', 'marketing-draft'],
      });
      toast.success('Campaign draft created. Review audience and content before launch.');
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Could not create campaign draft'); }
  };

  const typeHint = types.find(t => t.value === type)?.hint;
  const needsProduct = type === 'product_description';
  const needsContext = type === 'whatsapp_reply';
  const brandValues = (key: 'valueProps'|'preferredTerms'|'avoidTerms') => Array.isArray(brand[key]) ? (brand[key] as string[]).join(', ') : String(brand[key] || '');

  return <div className="h-full overflow-auto bg-slate-50">
    <div className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="mb-2 flex items-center gap-2 text-indigo-600"><Sparkles size={18}/><span className="text-xs font-semibold uppercase tracking-wider">Task 13 · Generative AI</span></div><h1 className="text-2xl font-semibold text-slate-900">Marketing Studio</h1><p className="mt-1 max-w-2xl text-sm text-slate-500">Create product copy, customer replies, campaigns, social posts and branded banner drafts. Every output is saved as a draft; nothing is sent or published automatically.</p></div>
        <button onClick={() => setBrandOpen(v=>!v)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"><ShieldCheck size={15}/> Brand voice & rules</button>
      </div>

      {brandOpen && <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">Brand consistency profile</h2><p className="text-xs text-slate-500">These rules are supplied to the AI and checked again after generation.</p></div><button disabled={saveBrand.isPending} onClick={()=>saveBrand.mutate()} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white"><Save size={13} className="mr-1 inline"/>Save brand profile</button></div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {([['brandName','Brand name'],['tagline','Tagline'],['voice','Brand voice'],['audience','Target audience'],['ctaStyle','CTA style'],['locale','Default language/locale']] as const).map(([key,label])=><label key={key} className="text-xs font-medium text-slate-600">{label}<input value={brand[key] || ''} onChange={e=>setBrandText(key,e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/></label>)}
          {([['valueProps','Value propositions'],['preferredTerms','Preferred terms'],['avoidTerms','Words/claims to avoid']] as const).map(([key,label])=><label key={key} className="text-xs font-medium text-slate-600">{label}<textarea value={brandValues(key)} onChange={e=>setBrand(prev=>({...prev,[key]:e.target.value as any}))} rows={2} placeholder="Comma-separated" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/></label>)}
          <div className="flex gap-3"><label className="flex-1 text-xs text-slate-600">Primary colour<input type="color" value={brand.primaryColor} onChange={e=>setBrandText('primaryColor',e.target.value)} className="mt-1 h-10 w-full rounded border"/></label><label className="flex-1 text-xs text-slate-600">Secondary colour<input type="color" value={brand.secondaryColor} onChange={e=>setBrandText('secondaryColor',e.target.value)} className="mt-1 h-10 w-full rounded border"/></label></div>
        </div>
      </section>}

      <div className="grid gap-5 lg:grid-cols-[minmax(320px,.85fr)_minmax(0,1.15fr)]">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center gap-2"><WandSparkles size={17} className="text-indigo-600"/><h2 className="font-semibold text-slate-900">Create marketing content</h2></div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Content type</label>
          <select value={type} onChange={e=>{setType(e.target.value as MarketingType);setResult(null)}} className="mb-2 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm">{types.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select>
          <p className="mb-4 text-xs text-slate-400">{typeHint}</p>
          {needsProduct && <div className="mb-3 space-y-2"><label className="block text-xs font-medium text-slate-600">Catalogue product</label><select value={productId} onChange={e=>setProductId(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm"><option value="">Choose saved product…</option>{(productsQ.data||[]).map(p=><option key={p.id} value={p.id}>{p.name} · {p.sku || p.id.slice(0,8)}</option>)}</select>{!productId&&<input value={productName} onChange={e=>setProductName(e.target.value)} placeholder="Or enter product name" className="w-full rounded-lg border border-slate-200 p-2.5 text-sm"/>}{selectedProduct&&<p className="text-[11px] text-slate-500">Current saved description: {selectedProduct.description || 'Not set'} · Price: {(selectedProduct.price/100).toFixed(2)} {selectedProduct.currency}</p>}</div>}
          {needsContext && <label className="mb-3 block text-xs font-medium text-slate-600">Customer message / conversation context<textarea value={context} onChange={e=>setContext(e.target.value)} rows={4} placeholder="Paste the customer's message. Remove private details not needed for the reply." className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm"/></label>}
          {!needsProduct && !needsContext && <label className="mb-3 block text-xs font-medium text-slate-600">Context / product / campaign details<textarea value={context} onChange={e=>setContext(e.target.value)} rows={3} placeholder="What are you promoting? Include only confirmed facts." className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm"/></label>}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-medium text-slate-600">Audience<input value={audience} onChange={e=>setAudience(e.target.value)} placeholder={brand.audience || 'e.g. returning customers'} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm"/></label>
            <label className="text-xs font-medium text-slate-600">Objective<input value={objective} onChange={e=>setObjective(e.target.value)} placeholder="e.g. increase enquiries" className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm"/></label>
            <label className="text-xs font-medium text-slate-600">Offer (optional)<input value={offer} onChange={e=>setOffer(e.target.value)} placeholder="Confirmed offer only" className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm"/></label>
            <label className="text-xs font-medium text-slate-600">Tone override<input value={tone} onChange={e=>setTone(e.target.value)} placeholder={brand.voice} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm"/></label>
            <label className="text-xs font-medium text-slate-600">Platform<select value={platform} onChange={e=>setPlatform(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm"><option>Instagram</option><option>Facebook</option><option>LinkedIn</option><option>X</option><option>Website</option><option>WhatsApp Status</option></select></label>
            <label className="text-xs font-medium text-slate-600">Channel<select value={channel} onChange={e=>setChannel(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm"><option value="WHATSAPP">WhatsApp</option><option value="EMAIL">Email</option><option value="SMS">SMS</option></select></label>
          </div>
          <label className="mt-3 block text-xs font-medium text-slate-600">Language<input value={language} onChange={e=>setLanguage(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm"/></label>
          <label className="mt-3 block text-xs font-medium text-slate-600">Additional constraints<textarea value={constraints} onChange={e=>setConstraints(e.target.value)} rows={2} placeholder="Character limits, required disclaimers, facts to exclude…" className="mt-1 w-full rounded-lg border border-slate-200 p-2.5 text-sm"/></label>
          <div className="mt-3 flex items-center justify-between"><label className="text-xs text-slate-600">Number of variants<select value={variants} onChange={e=>setVariants(Number(e.target.value))} className="ml-2 rounded-lg border border-slate-200 p-2"><option value={1}>1</option><option value={2}>2</option><option value={3}>3</option><option value={4}>4</option><option value={5}>5</option></select></label><button onClick={()=>generate.mutate()} disabled={generate.isPending || (needsProduct&&!productId&&!productName.trim()) || (needsContext&&!context.trim())} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"><Sparkles size={14}/>{generate.isPending?'Generating…':'Generate draft'}</button></div>
          <p className="mt-3 text-[10px] leading-4 text-slate-400">Requires a configured AI provider in Settings → AI. Generated drafts are saved automatically. Review factual claims, legal requirements and platform policies before publishing.</p>
        </section>

        <section className="min-w-0 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-slate-900">Generated content</h2>{assetId&&<span className="text-[10px] text-slate-400">Draft ID · {assetId.slice(0,10)}</span>}</div>
            {!result ? <div className="grid min-h-64 place-items-center text-center text-slate-400"><div><Sparkles size={28} className="mx-auto mb-3 text-slate-300"/><p className="text-sm font-medium">Your marketing draft will appear here</p><p className="mt-1 text-xs">Choose a content type and generate your first draft.</p></div></div> : <div className="space-y-4">
              <div><h3 className="text-lg font-semibold text-slate-900">{result.title}</h3><p className="mt-1 text-sm text-slate-500">{result.summary}</p></div>
              {result.brandCheck && <div className={`rounded-lg border p-3 ${result.brandCheck.passed?'border-emerald-200 bg-emerald-50':'border-amber-200 bg-amber-50'}`}><div className="flex items-center gap-2 text-xs font-semibold">{result.brandCheck.passed?<ShieldCheck size={14} className="text-emerald-600"/>:<AlertTriangle size={14} className="text-amber-600"/>}Brand check {result.brandCheck.passed?'passed':'needs review'}</div>{result.brandCheck.issues.map(x=><p key={x} className="mt-1 text-xs text-amber-800">{x}</p>)}{result.brandCheck.missingPreferred.length>0&&<p className="mt-1 text-xs text-slate-600">Preferred terms not used: {result.brandCheck.missingPreferred.join(', ')}</p>}</div>}
              {result.variants.map((v,i)=><article key={i} className="rounded-lg border border-slate-200 p-4"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-indigo-700">{v.label}</span><button onClick={()=>copy(v.content+(v.cta?'\n\n'+v.cta:'')+(v.hashtags?.length?'\n\n'+v.hashtags.join(' '):''))} className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-indigo-700"><Copy size={12}/>Copy</button></div><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{v.content}</p>{v.cta&&<p className="mt-2 text-xs font-semibold text-slate-900">CTA: {v.cta}</p>}{(v.hashtags?.length ?? 0)>0&&<p className="mt-2 text-xs text-indigo-600">{v.hashtags.join(' ')}</p>}{type==='product_description'&&productId&&<button onClick={()=>applyDescription.mutate(v.content)} disabled={applyDescription.isPending} className="mt-3 rounded-md border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700">Apply as product description</button>}</article>)}
              {result.banner&&<div className="space-y-3"><div className="overflow-hidden rounded-lg border border-slate-200"><div className="min-h-48 p-8 text-white" style={{background:`linear-gradient(130deg,${brand.primaryColor},${brand.secondaryColor})`}}><div className="text-xs font-bold uppercase tracking-widest opacity-80">{brand.brandName || 'YOUR BRAND'}</div><h3 className="mt-8 max-w-xl text-3xl font-black">{result.banner.headline}</h3><p className="mt-2 max-w-lg text-sm opacity-90">{result.banner.subheadline}</p><span className="mt-5 inline-block rounded-md bg-white px-4 py-2 text-xs font-bold text-slate-900">{result.banner.cta}</span></div></div><p className="text-xs text-slate-500">Visual direction: {result.banner.visualDirection}</p><p className="text-[11px] text-slate-400">Alt text: {result.banner.altText}</p><button onClick={downloadBanner} className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold"><Download size={13}/>Download SVG banner</button></div>}
              {result.campaign&&<button onClick={createCampaignDraft} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white"><Megaphone size={13} className="mr-1 inline"/>Create campaign draft</button>}
              {result.disclaimers?.map((d,i)=><p key={i} className="text-[11px] text-amber-700">Review: {d}</p>)}
              {result.brandNotes?.map((n,i)=><p key={i} className="text-[11px] text-slate-500">{n}</p>)}
            </div>}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-slate-900">Saved marketing drafts</h2><button onClick={()=>void assetsQ.refetch()} className="text-slate-400 hover:text-slate-700"><RefreshCw size={14}/></button></div>
            {assetsQ.isLoading?<p className="text-xs text-slate-400">Loading drafts…</p>:!assetsQ.data?.length?<p className="text-xs text-slate-400">No drafts generated yet.</p>:<div className="max-h-64 space-y-1 overflow-auto">{assetsQ.data.map(a=><button key={a.id} onClick={()=>loadAsset(a.id)} className={`flex w-full items-center justify-between rounded-lg p-2 text-left hover:bg-slate-50 ${historyId===a.id?'bg-indigo-50':''}`}><span className="min-w-0"><span className="block truncate text-xs font-semibold text-slate-700">{a.title}</span><span className="block text-[10px] text-slate-400">{a.type.replaceAll('_',' ')} · {new Date(a.createdAt).toLocaleString()}</span></span><span className="ml-3 shrink-0 text-[10px] text-slate-400">{a.status}</span></button>)}</div>}
          </div>
        </section>
      </div>
    </div>
  </div>;
}

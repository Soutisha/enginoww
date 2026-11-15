'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api-client';
import { toast } from 'sonner';
import { ArrowLeft, BrainCircuit, Check, ImagePlus, Loader2, Sparkles, Upload, X } from 'lucide-react';

type Analysis = {
  name: string;
  category: string | null;
  description: string;
  attributes: Record<string, string>;
  tags: string[];
  extractedText: string[];
  condition: string | null;
  imageQuality: 'good' | 'fair' | 'poor';
  confidence: number;
  warnings: string[];
};

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

export default function ProductVisionPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [result, setResult] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);

  const choose = (next?: File) => {
    if (!next) return;
    if (!ACCEPT.split(',').includes(next.type)) {
      toast.error('Choose a JPEG, PNG, WEBP or GIF image');
      return;
    }
    if (next.size > MAX_BYTES) {
      toast.error('Image must be 10 MB or smaller');
      return;
    }
    setFile(next);
    setResult(null);
    setPreview(URL.createObjectURL(next));
  };

  const analyze = async () => {
    if (!file) return;
    setBusy(true);
    const body = new FormData();
    body.append('image', file);
    try {
      const response = await api.post<{ data: Analysis }>('/products/vision/analyze', body);
      setResult(response.data.data);
      toast.success('Product image analyzed');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Image analysis failed');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!result) return;
    const text = [
      `Name: ${result.name}`,
      `Category: ${result.category || 'Unknown'}`,
      `Description: ${result.description}`,
      `Tags: ${result.tags.join(', ')}`,
      'Attributes:',
      ...Object.entries(result.attributes).map(([k, v]) => `- ${k}: ${v}`),
      `Visible text: ${result.extractedText.join(' | ')}`,
      `Condition: ${result.condition || 'Unknown'}`,
    ].join('\n');
    await navigator.clipboard.writeText(text);
    toast.success('Product details copied');
  };

  return (
    <div className="h-full overflow-auto bg-slate-50">
      <div className="max-w-5xl mx-auto p-5 md:p-8 space-y-6">
        <Link href="/products" className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-slate-900">
          <ArrowLeft size={14} /> Back to products
        </Link>
        <div>
          <div className="flex items-center gap-2 text-indigo-600 mb-2"><BrainCircuit size={18} /><span className="text-xs font-semibold uppercase tracking-wider">Product Intelligence</span></div>
          <h1 className="text-2xl font-semibold text-slate-900">Turn product photos into catalogue data</h1>
          <p className="text-sm text-slate-500 mt-1">Upload a clear product image. AI will identify visible details, read legible text and suggest structured product attributes.</p>
        </div>

        <div className="grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-5">
          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Product image</h2>
              <span className="text-[11px] text-slate-400">Max 10 MB</span>
            </div>
            {preview ? (
              <div className="relative border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                <img src={preview} alt="Selected product" className="w-full h-72 object-contain" />
                <button onClick={() => { setFile(null); setPreview(''); setResult(null); }} className="absolute top-2 right-2 bg-white/90 border rounded-full p-1.5 text-slate-600" aria-label="Remove image"><X size={14} /></button>
              </div>
            ) : (
              <button onClick={() => inputRef.current?.click()} className="w-full h-72 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-3 text-slate-500 hover:border-indigo-400 hover:bg-indigo-50/30">
                <ImagePlus size={32} className="text-slate-400" />
                <span className="text-sm font-medium">Choose a product image</span>
                <span className="text-xs text-slate-400">JPEG, PNG, WEBP or GIF</span>
              </button>
            )}
            <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => choose(e.target.files?.[0])} />
            <div className="flex gap-2">
              <button onClick={() => inputRef.current?.click()} className="flex-1 border border-slate-200 rounded-lg py-2 text-xs font-medium text-slate-700 flex items-center justify-center gap-2"><Upload size={14} /> {file ? 'Replace image' : 'Browse files'}</button>
              <button onClick={analyze} disabled={!file || busy} className="flex-1 bg-slate-900 text-white rounded-lg py-2 text-xs font-medium flex items-center justify-center gap-2 disabled:opacity-40">
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {busy ? 'Analyzing…' : 'Analyze image'}
              </button>
            </div>
            <p className="text-[11px] leading-relaxed text-slate-400">Images are sent to the AI provider configured in Settings → AI for analysis. The result is a suggestion, not a verified specification. No product is created automatically.</p>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-5 min-h-[420px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-900">Extracted product details</h2>
              {result && <button onClick={copy} className="text-xs text-indigo-600 hover:text-indigo-800">Copy details</button>}
            </div>
            {!result ? (
              <div className="h-80 flex flex-col items-center justify-center text-center text-slate-400">
                <BrainCircuit size={30} className="mb-3 text-slate-300" />
                <p className="text-sm font-medium text-slate-500">Your analysis will appear here</p>
                <p className="text-xs mt-1 max-w-xs">Choose an image and select Analyze image to generate catalogue-ready information.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400">Suggested product name</p>
                  <h3 className="text-lg font-semibold text-slate-900">{result.name}</h3>
                  <p className="text-xs text-slate-500">{result.category || 'Category not identified'} · {Math.round(result.confidence * 100)}% model confidence</p>
                </div>
                <div><p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Description</p><p className="text-sm text-slate-700">{result.description || 'No description returned.'}</p></div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">Detected attributes</p>
                  {Object.keys(result.attributes).length ? <div className="grid grid-cols-2 gap-2">{Object.entries(result.attributes).map(([key, value]) => <div key={key} className="bg-slate-50 rounded-md p-2"><p className="text-[10px] text-slate-400">{key}</p><p className="text-xs font-medium text-slate-800">{value}</p></div>)}</div> : <p className="text-xs text-slate-400">No reliable attributes detected.</p>}
                </div>
                {result.tags.length > 0 && <div><p className="text-[10px] uppercase tracking-wider text-slate-400 mb-2">Suggested tags</p><div className="flex flex-wrap gap-1.5">{result.tags.map((tag) => <span key={tag} className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[10px]">{tag}</span>)}</div></div>}
                {result.extractedText.length > 0 && <div><p className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">Visible text (OCR)</p><p className="text-xs text-slate-600">{result.extractedText.join(' · ')}</p></div>}
                <div className="flex items-center gap-2 text-xs text-slate-500"><Check size={13} /> Image quality: {result.imageQuality} · Condition: {result.condition || 'Not determined'}</div>
                {result.warnings.length > 0 && <div className="bg-amber-50 border border-amber-100 rounded-lg p-3"><p className="text-xs font-semibold text-amber-800 mb-1">Review these details</p><ul className="list-disc pl-4 text-[11px] text-amber-800 space-y-1">{result.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></div>}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

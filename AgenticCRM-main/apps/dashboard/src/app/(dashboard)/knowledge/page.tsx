'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api-client';
import { Brain, FileUp, FileText, Search, Trash2, ShieldCheck, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface KnowledgeDocument {
  id: string; path: string; originalName: string | null; mimeType: string | null;
  size: number; originalSize: number | null; access: string; isOwner: boolean; canDelete: boolean; sharedWithCount: number; updatedAt: string;
}
interface KnowledgeSource {
  id: string; documentId?: string; name: string; path: string; startLine: number;
  endLine: number; score: number; excerpt: string;
}
interface KnowledgeAnswer {
  content: string; sources: KnowledgeSource[]; grounded: boolean; provider?: string; model?: string;
}

export default function KnowledgePage() {
  const qc = useQueryClient();
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<KnowledgeAnswer | null>(null);
  const [visibility, setVisibility] = useState('COMPANY');

  const docs = useQuery({
    queryKey: ['business-knowledge-documents'],
    queryFn: async () => (await api.get<{ data: KnowledgeDocument[] }>('/memory/business-documents')).data.data,
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.onerror = () => reject(new Error('Could not read selected file'));
        reader.readAsDataURL(file);
      });
      return api.post('/memory/business-documents/upload', {
        fileName: file.name, mimeType: file.type || 'application/octet-stream',
        dataBase64, visibility,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['business-knowledge-documents'] });
      void qc.invalidateQueries({ queryKey: ['memory-stats'] });
      toast.success('Document uploaded and indexed');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Document upload failed'),
  });

  const ask = useMutation({
    mutationFn: async (query: string) =>
      (await api.post<{ data: KnowledgeAnswer }>('/ai/chat/knowledge', { query })).data.data,
    onSuccess: setAnswer,
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Knowledge search failed'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/memory/business-documents/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['business-knowledge-documents'] });
      setAnswer(null);
      toast.success('Knowledge document removed');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Could not remove document'),
  });

  return (
    <div className="h-full overflow-auto bg-slate-50 p-5 md:p-7 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-slate-900">
            <Brain size={20} />
            <h1 className="text-xl font-semibold">RAG Business Brain</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500">Ask questions across your business documents with source-grounded answers.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1.5">
          <ShieldCheck size={14} /> Company-scoped retrieval
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-xl p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileUp size={17} className="text-slate-700" />
          <h2 className="text-sm font-semibold text-slate-900">Add knowledge documents</h2>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <select value={visibility} onChange={(e) => setVisibility(e.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
            <option value="COMPANY">Visible to company</option>
            <option value="PRIVATE">Private to me</option>
          </select>
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800">
            {upload.isPending ? <Loader2 size={15} className="animate-spin" /> : <FileUp size={15} />}
            {upload.isPending ? 'Indexing…' : 'Upload document'}
            <input type="file" className="hidden" accept=".pdf,.docx,.txt,.md,.csv,.json,.html,.xml"
              disabled={upload.isPending}
              onChange={(e) => { const file = e.target.files?.[0]; if (file) upload.mutate(file); e.currentTarget.value = ''; }} />
          </label>
          <span className="text-xs text-slate-500">PDF, DOCX, TXT, MD, CSV, JSON, HTML or XML · max 15 MB</span>
        </div>
        <p className="mt-2 text-xs text-slate-400">Documents are parsed, chunked and indexed automatically. Scanned PDFs need OCR before upload.</p>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-5">
        <div className="bg-white border border-slate-200 rounded-xl p-4 md:p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles size={17} className="text-violet-600" />
            <h2 className="text-sm font-semibold text-slate-900">Ask your business brain</h2>
          </div>
          <textarea value={question} onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && question.trim()) ask.mutate(question.trim()); }}
            placeholder="e.g. What is our refund policy for damaged products?"
            className="min-h-24 w-full resize-y rounded-lg border border-slate-200 p-3 text-sm outline-none focus:border-slate-400" />
          <div className="flex justify-end">
            <button onClick={() => ask.mutate(question.trim())} disabled={!question.trim() || ask.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {ask.isPending ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
              {ask.isPending ? 'Searching documents…' : 'Ask question'}
            </button>
          </div>
          {answer && (
            <div className="border-t border-slate-100 pt-4 space-y-4">
              <div className="whitespace-pre-wrap text-sm leading-7 text-slate-800">{answer.content}</div>
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <FileText size={13} /> Sources ({answer.sources.length})
                </div>
                <div className="space-y-2">
                  {answer.sources.map((source) => (
                    <div key={source.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-slate-800">[{source.id}] {source.name}</span>
                        <span className="shrink-0 text-slate-400">Lines {source.startLine}–{source.endLine}</span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-600">{source.excerpt}</p>
                    </div>
                  ))}
                </div>
              </div>
              {answer.provider && <p className="text-[10px] text-slate-400">Generated with {answer.provider} · {answer.model}</p>}
            </div>
          )}
        </div>

        <aside className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Indexed documents</h2>
            <span className="text-xs text-slate-400">{docs.data?.length ?? 0}</span>
          </div>
          {docs.isLoading ? <p className="text-xs text-slate-400">Loading documents…</p> :
            !docs.data?.length ? <p className="py-8 text-center text-xs text-slate-400">No business documents indexed yet.</p> :
            <div className="space-y-2">
              {docs.data.map((doc) => (
                <div key={doc.id} className="flex items-start gap-2 rounded-lg border border-slate-100 p-2.5">
                  <FileText size={15} className="mt-0.5 shrink-0 text-slate-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-800">{doc.originalName || doc.path}</p>
                    <p className="mt-1 text-[10px] text-slate-400">{((doc.originalSize ?? doc.size) / 1024).toFixed(1)} KB · {doc.access.toLowerCase()}</p>
                  </div>
                  {(doc.canDelete) && <button onClick={() => remove.mutate(doc.id)} title="Delete document"
                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>}
                </div>
              ))}
            </div>}
        </aside>
      </section>
    </div>
  );
}

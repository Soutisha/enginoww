'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import Image from 'next/image';
import Link from 'next/link';
import api from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth.store';

type RegisterResponse = {
  data: {
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
      permissions: string[];
      companyId: string;
    };
    accessToken: string;
    refreshToken: string;
  };
};

export default function RegisterPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    companyName: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });

  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form.password.length < 8) {
      toast.error('Use a password with at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      const response = await api.post<RegisterResponse>('/auth/register', form);
      const { user, accessToken, refreshToken } = response.data.data;
      setAuth(user, accessToken, refreshToken);
      toast.success('Your workspace is ready');
      router.push('/chat');
    } catch (error: unknown) {
      const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Could not create your workspace';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full rounded-md border border-gray-200 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-400';

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f0f10] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-7">
          <Image src="/full_logo.png" alt="AgenticCRM" width={220} height={60} className="invert" priority unoptimized />
        </div>
        <div className="rounded-lg bg-white p-6 shadow-2xl shadow-black/20">
          <h1 className="mb-1 text-base font-semibold text-gray-900">Create your workspace</h1>
          <p className="mb-5 text-xs text-gray-500">Set up your BizPilot account to start managing your business.</p>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-600">Company / workspace name</label>
              <input required maxLength={100} value={form.companyName} onChange={(e) => update('companyName', e.target.value)} className={inputClass} placeholder="Acme Technologies" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-600">First name</label>
                <input required maxLength={50} value={form.firstName} onChange={(e) => update('firstName', e.target.value)} className={inputClass} placeholder="First name" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-600">Last name</label>
                <input required maxLength={50} value={form.lastName} onChange={(e) => update('lastName', e.target.value)} className={inputClass} placeholder="Last name" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-600">Email</label>
              <input required type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className={inputClass} placeholder="you@company.com" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-600">Password</label>
              <input required minLength={8} maxLength={128} type="password" value={form.password} onChange={(e) => update('password', e.target.value)} className={inputClass} placeholder="At least 8 characters" />
            </div>
            <button type="submit" disabled={loading} className="mt-2 w-full rounded-md bg-gray-900 py-2.5 text-xs font-semibold text-white transition hover:bg-gray-800 disabled:opacity-40">
              {loading ? 'Creating workspace...' : 'Create workspace'}
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-gray-900 hover:underline">Sign in</Link>
          </p>
        </div>
        <p className="mt-5 text-center text-[10px] text-gray-500">BizPilot · AgenticCRM</p>
      </div>
    </div>
  );
}

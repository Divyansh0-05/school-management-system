'use client';

import { LoginRequestSchema } from '@school/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiRequest } from '../../lib/api';
import { useToast } from '../../components/toast';

export default function LoginPage() {
  const router = useRouter();
  const notify = useToast();
  const [values, setValues] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const production = process.env.NODE_ENV === 'production';
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = LoginRequestSchema.safeParse(values);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || 'Check your credentials'); return; }
    setPending(true); setError('');
    try {
      const body = await apiRequest<{ user: { role: string } }>('/auth/login', { method: 'POST', body: JSON.stringify(parsed.data) });
      notify('Signed in successfully');
      router.push(body.user.role === 'ADMIN' ? '/admin' : body.user.role === 'TEACHER' ? '/teacher' : '/guardian');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign in');
    } finally { setPending(false); }
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <form onSubmit={submit} className="w-full space-y-6 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm" aria-labelledby="login-title">
        <div><p className="text-sm font-semibold uppercase tracking-wide text-teal-700">School management</p><h1 id="login-title" className="mt-2 text-3xl font-bold">Sign in</h1><p className="mt-2 text-sm text-slate-600">Use your school account to continue.</p></div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <label className="block text-sm font-medium">Email<input required type="email" value={values.email} onChange={(event) => setValues({ ...values, email: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
        <label className="block text-sm font-medium">Password<input required type="password" value={values.password} onChange={(event) => setValues({ ...values, password: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
        {!production && <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Demo: admin@school.demo / Demo@12345</p>}
        <button disabled={pending} className="w-full rounded-lg bg-teal-700 px-4 py-2.5 font-semibold text-white disabled:opacity-50">{pending ? 'Signing in…' : 'Sign in'}</button>
        <a href="/change-password" className="block text-center text-sm text-teal-700 underline">Change password</a>
      </form>
    </main>
  );
}

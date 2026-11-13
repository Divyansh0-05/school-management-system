'use client';

import { LoginRequestSchema } from '@school/shared';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiRequest } from '../../lib/api';
import { useToast } from '../../components/toast';

const demoAccounts = [
  { role: 'Admin', email: 'admin@school.demo' },
  { role: 'Teacher 1', email: 'teacher1@school.demo' },
  { role: 'Teacher 2', email: 'teacher2@school.demo' },
  { role: 'Guardian 1', email: 'guardian1@school.demo' },
  { role: 'Guardian 2', email: 'guardian2@school.demo' },
];

export default function LoginPage() {
  const router = useRouter();
  const notify = useToast();
  const [values, setValues] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = LoginRequestSchema.safeParse(values);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Check your credentials');
      return;
    }
    setPending(true);
    setError('');
    try {
      const body = await apiRequest<{ user: { role: string } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      notify('Signed in successfully');
      router.push(body.user.role === 'ADMIN' ? '/admin' : body.user.role === 'TEACHER' ? '/teacher' : '/guardian');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to sign in');
    } finally {
      setPending(false);
    }
  }

  function fillDemo(email: string) {
    setValues({ email, password: 'Demo@12345' });
    setError('');
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <form
        onSubmit={submit}
        className="w-full space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
        aria-labelledby="login-title"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">School OS</p>
          <h1 id="login-title" className="mt-1 text-3xl font-bold text-slate-900">
            Sign in
          </h1>
          <p className="mt-1 text-sm text-slate-600">Use your school account to access your portal.</p>
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}

        <label className="block text-sm font-medium text-slate-700">
          Email
          <input
            required
            type="email"
            value={values.email}
            onChange={(event) => setValues({ ...values, email: event.target.value })}
            placeholder="you@school.demo"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Password
          <input
            required
            type="password"
            value={values.password}
            onChange={(event) => setValues({ ...values, password: event.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </label>

        <button
          disabled={pending}
          className="w-full rounded-lg bg-teal-700 px-4 py-2.5 font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:opacity-50"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>

        {/* Demo credentials hint panel */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-700">Demo accounts</p>
            <span className="text-xs font-mono text-slate-500">Demo@12345</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Click any account to fill:</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {demoAccounts.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => fillDemo(acc.email)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:border-teal-600 hover:text-teal-700 focus:outline-none focus:ring-1 focus:ring-teal-600"
              >
                {acc.role}
              </button>
            ))}
          </div>
        </div>

        <div className="text-center">
          <a href="/change-password" className="text-sm font-medium text-teal-700 underline hover:text-teal-800">
            Change password
          </a>
        </div>
      </form>
    </main>
  );
}

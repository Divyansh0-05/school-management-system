'use client';

import { ChangePasswordRequestSchema } from '@school/shared';
import { useState } from 'react';
import { apiRequest } from '../../lib/api';

export default function ChangePasswordPage() {
  const [values, setValues] = useState({ currentPassword: '', newPassword: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = ChangePasswordRequestSchema.safeParse(values);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message || 'Check the form'); return; }
    try { await apiRequest('/auth/change-password', { method: 'POST', body: JSON.stringify(parsed.data) }); setMessage('Password changed.'); setError(''); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to change password'); }
  }
  return <main className="mx-auto flex min-h-screen max-w-md items-center px-4"><form onSubmit={submit} className="w-full space-y-5 rounded-2xl border bg-white p-8 shadow-sm"><div><h1 className="text-2xl font-bold text-slate-900">Change password</h1><p className="mt-1 text-sm text-slate-600">Update your account credentials to keep your portal access secure.</p></div>{message && <p role="status" className="bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}{error && <p role="alert" className="bg-red-50 p-3 text-sm text-red-800">{error}</p>}<label className="block text-sm font-medium">Current password<input required type="password" value={values.currentPassword} onChange={(e) => setValues({ ...values, currentPassword: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><label className="block text-sm font-medium">New password<input required type="password" value={values.newPassword} onChange={(e) => setValues({ ...values, newPassword: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label><button className="w-full rounded-lg bg-teal-700 px-4 py-2.5 font-semibold text-white">Update password</button><a href="/login" className="block text-center text-sm text-teal-700 underline">Back to sign in</a></form></main>;
}

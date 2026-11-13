'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api';
export default function Page() {
  const [action, setAction] = useState('');
  const logs = useQuery({ queryKey: ['audit-logs', action], queryFn: () => apiRequest<{ data: Array<{ id?: string; _id?: string; action: string; entity_type: string; actor_role: string; at: string }>; meta: { total: number } }>(`/audit-logs?pageSize=100${action ? `&action=${action}` : ''}`) });
  return <section><h1 className="text-3xl font-bold">Audit logs</h1><label className="mt-6 block max-w-xs text-sm font-semibold">Action<input value={action} onChange={(event) => setAction(event.target.value)} placeholder="e.g. PAYMENT" className="mt-1 block w-full rounded-lg border px-3 py-2" /></label><div className="mt-6 overflow-x-auto rounded-2xl border bg-white"><table className="w-full text-left text-sm"><thead><tr className="border-b bg-slate-50"><th className="p-3">Time</th><th className="p-3">Action</th><th className="p-3">Entity</th><th className="p-3">Role</th></tr></thead><tbody>{(logs.data?.data || []).length === 0 ? <tr><td colSpan={4} className="p-6 text-center text-slate-500">No audit logs</td></tr> : (logs.data?.data || []).map((log) => <tr key={log.id || log._id} className="border-b"><td className="p-3">{new Date(log.at).toLocaleString()}</td><td className="p-3">{log.action}</td><td className="p-3">{log.entity_type}</td><td className="p-3">{log.actor_role}</td></tr>)}</tbody></table></div></section>;
}

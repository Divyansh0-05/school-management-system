'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest, type ApiProblem } from '../../../lib/api';

interface AuditRow {
  id?: string;
  _id?: string;
  at?: string | Date;
  action?: string;
  entity_type?: string;
  entity_id?: string;
  actor_role?: string;
  request_id?: string;
  ip?: string;
}

interface AuditResponse {
  data: AuditRow[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

function formatDate(value: unknown) {
  if (!value) return '-';
  try {
    const d = new Date(value as string | number | Date);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString();
  } catch {
    return '-';
  }
}

export default function AuditLogsPage() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);

  const logs = useQuery({
    queryKey: ['audit-logs', action, page],
    queryFn: () =>
      apiRequest<AuditResponse>(
        `/audit-logs?page=${page}&pageSize=20${action ? `&action=${encodeURIComponent(action)}` : ''}`
      ),
  });

  const totalPages = logs.data?.meta?.totalPages || 1;
  const total = logs.data?.meta?.total ?? 0;
  const rows = logs.data?.data || [];

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Audit logs</h1>
        <p className="mt-1 text-slate-600">Track mutations and security events across the system.</p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="block max-w-xs text-sm font-semibold">
          Action filter
          <input
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
            }}
            placeholder="e.g. PAYMENT, CREATE, VOID"
            className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </label>
      </div>

      {logs.isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800" role="alert">
          <p className="font-semibold">
            {(logs.error as Error & { problem?: ApiProblem })?.problem?.detail ||
              logs.error?.message ||
              'Could not load audit logs.'}
          </p>
          <button
            type="button"
            onClick={() => logs.refetch()}
            className="mt-2 rounded-lg bg-red-100 px-3 py-1 text-sm font-semibold text-red-800 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-600"
          >
            Retry
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
        {logs.isLoading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3">Time</th>
                <th scope="col" className="px-4 py-3">Action</th>
                <th scope="col" className="px-4 py-3">Entity type</th>
                <th scope="col" className="px-4 py-3">Entity id</th>
                <th scope="col" className="px-4 py-3">Actor role</th>
                <th scope="col" className="px-4 py-3">Request id</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500">
                    No audit logs
                  </td>
                </tr>
              ) : (
                rows.map((log, index) => (
                  <tr key={log.id || log._id || index} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDate(log.at)}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{log.action || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{log.entity_type || '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{log.entity_id || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{log.actor_role || '-'}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{log.request_id || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">{total} events</span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1 || logs.isLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border bg-white px-3 py-1 font-medium hover:bg-slate-50 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="px-2 py-1 text-slate-600">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages || logs.isLoading}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border bg-white px-3 py-1 font-medium hover:bg-slate-50 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

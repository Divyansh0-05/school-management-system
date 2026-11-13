'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../lib/api';
import { formatDate, formatMoney } from '../lib/format';
import { StatusBadge } from './status-badge';

export function AdminDashboard() {
  const query = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () =>
      apiRequest<{
        data: {
          activeStudents: number;
          attendance: { percentageHundredths: number };
          fees: { billedPaise: number; collectedPaise: number; outstandingPaise: number; overduePaise: number };
          recentAudit: Array<{ id?: string; _id?: string; action: string; entity_type: string; at: string }>;
        };
      }>('/dashboard/admin'),
  });

  if (query.isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800" role="alert">
        <p className="font-semibold">Could not load dashboard data.</p>
        <button
          onClick={() => query.refetch()}
          className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 font-semibold hover:bg-red-50"
        >
          Retry
        </button>
      </div>
    );
  }

  const data = query.data.data;
  const tiles = [
    ['Active students', String(data.activeStudents)],
    ["Today's attendance", `${(data.attendance.percentageHundredths / 100).toFixed(2)}%`],
    ['Fees billed', formatMoney(data.fees.billedPaise)],
    ['Collected', formatMoney(data.fees.collectedPaise)],
    ['Outstanding', formatMoney(data.fees.outstandingPaise)],
    ['Overdue', formatMoney(data.fees.overduePaise)],
  ];

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Admin dashboard</h1>
        <p className="mt-1 text-slate-600">Overview of enrollment, attendance, financial health, and audit logs.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">Recent audit events</h2>
          <Link href="/admin/audit-logs" className="text-sm font-semibold text-teal-700 hover:underline">
            View all →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3">Action</th>
                <th scope="col" className="px-4 py-3">Entity</th>
                <th scope="col" className="px-4 py-3">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data.recentAudit || []).length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                    No recent audit events
                  </td>
                </tr>
              ) : (
                data.recentAudit.map((event) => (
                  <tr key={event.id || event._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <StatusBadge value={event.action} />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{event.entity_type}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(event.at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

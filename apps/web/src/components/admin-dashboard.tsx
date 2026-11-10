'use client';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../lib/api';
const money = (value: number) => `₹${(value / 100).toFixed(2)}`;
export function AdminDashboard() {
  const query = useQuery({ queryKey: ['admin-dashboard'], queryFn: () => apiRequest<{ data: { activeStudents: number; attendance: { percentageHundredths: number }; fees: { billedPaise: number; collectedPaise: number; outstandingPaise: number; overduePaise: number }; recentAudit: Array<{ id?: string; _id?: string; action: string; entity_type: string; at: string }> } }>('/dashboard/admin') });
  if (query.isLoading) return <p>Loading dashboard…</p>;
  if (query.isError || !query.data) return <p role="alert">Could not load dashboard.</p>;
  const data = query.data.data;
  const tiles = [['Active students', String(data.activeStudents)], ["Today's attendance", `${(data.attendance.percentageHundredths / 100).toFixed(2)}%`], ['Fees billed', money(data.fees.billedPaise)], ['Collected', money(data.fees.collectedPaise)], ['Outstanding', money(data.fees.outstandingPaise)], ['Overdue', money(data.fees.overduePaise)]];
  return <section><h1 className="text-3xl font-bold">Admin dashboard</h1><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{tiles.map(([label, value]) => <div key={label} className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>)}</div><div className="mt-8 rounded-2xl border bg-white p-5"><div className="flex justify-between"><h2 className="text-xl font-bold">Recent audit events</h2><a href="/admin/audit-logs" className="text-teal-700 underline">View all</a></div>{data.recentAudit.map((event) => <div key={event.id || event._id} className="flex justify-between border-b py-3 text-sm"><span>{event.action}</span><span>{event.entity_type}</span><span>{new Date(event.at).toLocaleString()}</span></div>)}</div></section>;
}

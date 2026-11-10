'use client';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../../../lib/api';
const rupees = (value: number) => `₹${(value / 100).toFixed(2)}`;
export default function Page() {
  const summary = useQuery({ queryKey: ['fee-summary'], queryFn: () => apiRequest<{ data: { billedPaise: number; collectedPaise: number; outstandingPaise: number; overduePaise: number } }>('/reports/fees/summary') });
  const reconciliation = useQuery({ queryKey: ['fee-reconciliation'], queryFn: () => apiRequest<{ data: { mismatches: Array<{ invoiceId: string; reason: string; expected: number; ledgerSum: number }> } }>('/reports/fees/reconciliation') });
  const fees = summary.data?.data;
  return <section><h1 className="text-3xl font-bold">Fee reports</h1><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[['Billed', fees?.billedPaise], ['Collected', fees?.collectedPaise], ['Outstanding', fees?.outstandingPaise], ['Overdue', fees?.overduePaise]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{rupees(Number(value || 0))}</p></div>)}</div><div className="mt-8 rounded-2xl border bg-white p-5"><h2 className="text-xl font-bold">Reconciliation</h2>{reconciliation.data?.data.mismatches.length === 0 ? <p className="mt-4 rounded-lg bg-green-50 p-4 font-semibold text-green-800">All invoices reconcile</p> : <div className="mt-4 divide-y">{(reconciliation.data?.data.mismatches || []).map((row) => <div key={row.invoiceId} className="grid gap-2 py-3 sm:grid-cols-4"><span>{row.invoiceId}</span><span>{row.reason}</span><span>{rupees(row.expected)}</span><span>{rupees(row.ledgerSum)}</span></div>)}</div>}</div></section>;
}

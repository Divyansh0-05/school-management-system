'use client';

import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../../../lib/api';
import { formatMoney } from '../../../../lib/format';

export default function FeeReportsPage() {
  const summary = useQuery({
    queryKey: ['fee-summary'],
    queryFn: () =>
      apiRequest<{
        data: {
          billedPaise: number;
          collectedPaise: number;
          outstandingPaise: number;
          overduePaise: number;
        };
      }>('/reports/fees/summary'),
  });

  const reconciliation = useQuery({
    queryKey: ['fee-reconciliation'],
    queryFn: () =>
      apiRequest<{
        data: {
          mismatches: Array<{
            invoiceId: string;
            reason: string;
            expected: number;
            ledgerSum: number;
          }>;
        };
      }>('/reports/fees/reconciliation'),
  });

  const fees = summary.data?.data;
  const tiles = [
    ['Billed', fees?.billedPaise],
    ['Collected', fees?.collectedPaise],
    ['Outstanding', fees?.outstandingPaise],
    ['Overdue', fees?.overduePaise],
  ];

  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Fee reports</h1>
        <p className="mt-1 text-slate-600">Financial summary, collection health, and ledger reconciliation.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{formatMoney(Number(value || 0))}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Reconciliation</h2>
        {reconciliation.isLoading ? (
          <div className="mt-4 h-20 animate-pulse rounded-lg bg-slate-100" />
        ) : (reconciliation.data?.data.mismatches || []).length === 0 ? (
          <p className="mt-4 rounded-lg bg-emerald-50 p-4 font-semibold text-emerald-800">
            ✓ All invoices reconcile with student ledgers.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3">Invoice</th>
                  <th scope="col" className="px-4 py-3">Reason</th>
                  <th scope="col" className="px-4 py-3 text-right">Expected</th>
                  <th scope="col" className="px-4 py-3 text-right">Ledger sum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(reconciliation.data?.data.mismatches || []).map((row) => (
                  <tr key={row.invoiceId} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs">{row.invoiceId}</td>
                    <td className="px-4 py-3 text-slate-700">{row.reason}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(row.expected)}</td>
                    <td className="px-4 py-3 text-right">{formatMoney(row.ledgerSum)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

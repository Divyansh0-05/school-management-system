'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, type ApiProblem } from '../lib/api';
import { formatDate, formatMoney } from '../lib/format';
import { StatusBadge } from './status-badge';

type Invoice = {
  id: string;
  invoice_no: string;
  student_id: string;
  period_label: string;
  due_date: string;
  status: string;
  total_paise: number;
  invoice_items: Array<{ description: string; amount_paise: number }>;
};
type Payment = { id: string; amount_paise: number; method: string; status: string; receipt_no: string };
type Ledger = { id: string; invoice_id?: string; type: string; amount_paise: number; createdAt: string };
type ProblemError = Error & { problem?: ApiProblem };

const recordId = (value: { id?: string; _id?: string }) => value.id || value._id || '';

const friendly = (error: unknown, invoiceStatus?: string) => {
  const prob = (error as ProblemError).problem;
  const code = prob?.code || '';
  if (
    invoiceStatus === 'PAID' ||
    prob?.detail?.toLowerCase().includes('already paid') ||
    (prob?.status === 409 && invoiceStatus === 'PAID')
  ) {
    return 'This invoice is already paid.';
  }
  const map: Record<string, string> = {
    INVOICE_HAS_PAYMENTS: 'This invoice has successful payments and cannot be voided.',
    INVALID_STATE_TRANSITION:
      invoiceStatus === 'PAID' ? 'This invoice is already paid.' : 'That action is not available for this invoice.',
    OVERPAYMENT: 'The payment is greater than the outstanding balance.',
    IDEMPOTENCY_KEY_REUSED: 'This payment attempt has already been processed with different details.',
  };
  return map[code] || prob?.detail || (error as Error).message || 'Unable to complete request. Please try again.';
};

function mapInvoice(value: Invoice & { _id?: string }) {
  return { ...value, id: recordId(value) };
}

export function AdminInvoices() {
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [period, setPeriod] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [amount, setAmount] = useState('');

  const query = useQuery({
    queryKey: ['invoices', status],
    queryFn: () =>
      apiRequest<{ data: Array<Invoice & { _id?: string }>; meta: { total: number } }>(
        `/invoices?pageSize=100${status ? `&status=${status}` : ''}`
      ),
  });
  const students = useQuery({
    queryKey: ['invoice-students'],
    queryFn: () =>
      apiRequest<{ data: Array<{ id?: string; _id?: string; full_name?: string; fullName?: string }> }>(
        '/students?pageSize=100'
      ),
  });
  const heads = useQuery({
    queryKey: ['fee-heads'],
    queryFn: () => apiRequest<{ data: Array<{ id?: string; _id?: string; name: string }> }>('/fee-heads?pageSize=100'),
  });
  const years = useQuery({
    queryKey: ['invoice-years'],
    queryFn: () =>
      apiRequest<{ data: Array<{ id?: string; _id?: string; is_current: boolean }> }>('/academic-years?pageSize=100'),
  });

  const create = useMutation({
    mutationFn: () =>
      apiRequest('/invoices', {
        method: 'POST',
        body: JSON.stringify({
          studentId,
          academicYearId: recordId(years.data?.data.find((year) => year.is_current) || {}),
          periodLabel: period,
          dueDate,
          items: [
            {
              feeHeadId: heads.data?.data[0] && recordId(heads.data.data[0]),
              description: heads.data?.data[0]?.name || 'Fee',
              amountPaise: Math.round(Number(amount) * 100),
            },
          ],
        }),
      }),
    onSuccess: () => {
      setOpen(false);
      query.refetch();
    },
  });

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Fees</p>
          <h1 className="mt-1 text-3xl font-bold">Invoices</h1>
          <p className="mt-1 text-slate-600">Issue, track, and reconcile fee invoices.</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => setOpen(!open)}
            className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            {open ? 'Close form' : 'Create invoice'}
          </button>
          <Link href="/admin/reports/fees" className="self-center text-sm font-semibold text-teal-700 underline">
            Fee reports →
          </Link>
        </div>
      </div>

      {open && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
          className="grid gap-4 rounded-2xl border bg-white p-5 shadow-sm sm:grid-cols-2"
        >
          <label className="text-sm font-semibold text-slate-700">
            Student
            <select
              required
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              <option value="">Select student</option>
              {(students.data?.data || []).map((student) => (
                <option key={recordId(student)} value={recordId(student)}>
                  {student.full_name || student.fullName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Period
            <input
              required
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              placeholder="e.g. Term 1 2026"
              className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Due date
            <input
              required
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
              className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Amount (rupees)
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="e.g. 15000"
              className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </label>
          <button
            disabled={create.isPending}
            className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800 disabled:opacity-50 sm:col-span-2"
          >
            {create.isPending ? 'Saving…' : 'Save draft invoice'}
          </button>
        </form>
      )}

      <div className="max-w-xs">
        <label className="block text-sm font-semibold text-slate-700">
          Filter by status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            <option value="">All statuses</option>
            {['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID'].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
        {query.isLoading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3">Invoice</th>
                <th scope="col" className="px-4 py-3">Period</th>
                <th scope="col" className="px-4 py-3">Due date</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(query.data?.data || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    No invoices found.
                  </td>
                </tr>
              ) : (
                (query.data?.data || []).map((raw) => {
                  const invoice = mapInvoice(raw);
                  return (
                    <tr key={invoice.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        <Link href={`/admin/invoices/${invoice.id}`} className="text-teal-700 hover:underline">
                          {invoice.invoice_no}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{invoice.period_label}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(invoice.due_date)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge value={invoice.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {formatMoney(invoice.total_paise)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export function InvoiceDetail({ guardian = false }: { guardian?: boolean }) {
  const params = useParams<{ id: string }>();
  const client = useQueryClient();
  const [message, setMessage] = useState('');

  const invoice = useQuery({
    queryKey: ['invoice', params.id],
    queryFn: async () => {
      const response = await apiRequest<{ data: Invoice & { _id?: string } }>(`/invoices/${params.id}`);
      return mapInvoice(response.data);
    },
  });

  const ledger = useQuery({
    queryKey: ['ledger', invoice.data?.student_id],
    enabled: Boolean(invoice.data?.student_id),
    queryFn: () =>
      apiRequest<{ data: Array<Ledger & { _id?: string }> }>(`/students/${invoice.data!.student_id}/ledger`),
  });

  const payments = useQuery({
    queryKey: ['payments', params.id],
    queryFn: () =>
      apiRequest<{ data: Array<Payment & { _id?: string }> }>(`/payments?invoiceId=${params.id}&pageSize=100`),
  });

  const action = useMutation({
    mutationFn: (kind: 'issue' | 'void') =>
      apiRequest(`/invoices/${params.id}/${kind}`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => {
      setMessage('Invoice updated.');
      client.invalidateQueries({ queryKey: ['invoice', params.id] });
      client.invalidateQueries({ queryKey: ['ledger'] });
    },
    onError: (error) => setMessage(friendly(error)),
  });

  if (invoice.isLoading) return <div className="h-48 animate-pulse rounded-2xl bg-slate-200" />;
  if (invoice.isError || !invoice.data) return <p role="alert" className="text-red-700">Invoice not found.</p>;

  const item = invoice.data;
  const paidPaise = (payments.data?.data || [])
    .filter((payment) => payment.status === 'SUCCEEDED')
    .reduce((sum, payment) => sum + payment.amount_paise, 0);
  const outstanding = Math.max(0, item.total_paise - paidPaise);

  return (
    <section className="space-y-6">
      <Link href={guardian ? '/guardian' : '/admin/invoices'} className="text-sm font-semibold text-teal-700 underline">
        ← Back
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{item.invoice_no}</h1>
          <p className="mt-1 text-slate-600">
            {item.period_label} · Due {formatDate(item.due_date)} · Total {formatMoney(item.total_paise)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge value={item.status} />
          {guardian && item.status !== 'PAID' && item.status !== 'VOID' && outstanding > 0 && (
            <Link
              href={`/guardian/payments/${item.id}`}
              className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800"
            >
              Pay (simulated)
            </Link>
          )}
        </div>
      </div>

      {message && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {message}
        </p>
      )}

      {!guardian && (
        <div className="flex gap-2">
          {item.status === 'DRAFT' && (
            <button
              onClick={() => action.mutate('issue')}
              className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800"
            >
              Issue
            </button>
          )}
          {(item.status === 'DRAFT' || item.status === 'ISSUED') && (
            <button
              onClick={() => {
                if (window.confirm('Void this invoice?')) action.mutate('void');
              }}
              className="rounded-lg border border-red-300 bg-white px-4 py-2 font-semibold text-red-700 hover:bg-red-50"
            >
              Void
            </button>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Items table */}
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="font-bold text-slate-900">Invoice items</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3">Description</th>
                  <th scope="col" className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(item.invoice_items || []).map((row) => (
                  <tr key={row.description} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-900">{row.description}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">{formatMoney(row.amount_paise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Payments table */}
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="font-bold text-slate-900">Payments</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3">Receipt</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(payments.data?.data || []).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                      No payments recorded yet
                    </td>
                  </tr>
                ) : (
                  (payments.data?.data || []).map((row) => (
                    <tr key={recordId(row)} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{row.receipt_no}</td>
                      <td className="px-4 py-3">
                        <StatusBadge value={row.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">{formatMoney(row.amount_paise)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Ledger table */}
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b px-5 py-4">
          <h2 className="font-bold text-slate-900">Student ledger</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3">Date</th>
                <th scope="col" className="px-4 py-3">Type</th>
                <th scope="col" className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(ledger.data?.data || []).filter((row) => row.invoice_id === params.id || !row.invoice_id).length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                    No ledger entries
                  </td>
                </tr>
              ) : (
                (ledger.data?.data || [])
                  .filter((row) => row.invoice_id === params.id || !row.invoice_id)
                  .map((row) => (
                    <tr key={recordId(row)} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600">{formatDate(row.createdAt)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{row.type}</td>
                      <td
                        className={`px-4 py-3 text-right font-medium ${
                          row.amount_paise < 0 ? 'text-emerald-700' : 'text-slate-900'
                        }`}
                      >
                        {formatMoney(row.amount_paise)}
                      </td>
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

export function SimulatedPayment() {
  const params = useParams<{ id: string }>();
  const client = useQueryClient();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('SIMULATED_CARD');
  const [outcome, setOutcome] = useState('SUCCEEDED');
  const [message, setMessage] = useState('');

  const invoice = useQuery({
    queryKey: ['invoice-pay', params.id],
    queryFn: () => apiRequest<{ data: Invoice & { _id?: string } }>(`/invoices/${params.id}`),
  });
  const payments = useQuery({
    queryKey: ['payments', params.id],
    queryFn: () =>
      apiRequest<{ data: Array<Payment & { _id?: string }> }>(`/payments?invoiceId=${params.id}&pageSize=100`),
  });

  const data = invoice.data?.data;
  const paidPaise = (payments.data?.data || [])
    .filter((payment) => payment.status === 'SUCCEEDED')
    .reduce((sum, payment) => sum + payment.amount_paise, 0);
  const outstanding = data ? Math.max(0, data.total_paise - paidPaise) : 0;
  const isPaidOrVoid = data?.status === 'PAID' || data?.status === 'VOID';
  const canPay = outstanding > 0 && !isPaidOrVoid;

  const pay = useMutation({
    mutationFn: async () => {
      const keyName = `payment-attempt-${params.id}-${outcome}`;
      const key = sessionStorage.getItem(keyName) || crypto.randomUUID();
      sessionStorage.setItem(keyName, key);
      try {
        return await apiRequest(`/invoices/${params.id}/payments`, {
          method: 'POST',
          headers: { 'Idempotency-Key': key },
          body: JSON.stringify({
            amountPaise: Math.round(Number(amount || outstanding / 100) * 100),
            method,
            simulatedStatus: outcome,
          }),
        });
      } finally {
        sessionStorage.removeItem(keyName);
      }
    },
    onSuccess: () => {
      setMessage(
        outcome === 'FAILED' ? 'Payment failed; your balance is unchanged.' : 'Payment recorded successfully.'
      );
      client.invalidateQueries({ queryKey: ['invoice-pay', params.id] });
      client.invalidateQueries({ queryKey: ['invoice', params.id] });
      client.invalidateQueries({ queryKey: ['payments', params.id] });
      client.invalidateQueries({ queryKey: ['guardian-invoices'] });
      client.invalidateQueries({ queryKey: ['ledger'] });
    },
    onError: (error) => setMessage(friendly(error, data?.status)),
  });

  if (invoice.isLoading || payments.isLoading) return <div className="h-48 animate-pulse rounded-2xl bg-slate-200" />;
  if (!data) return <p role="alert" className="text-red-700">Invoice not found.</p>;

  return (
    <section className="max-w-xl space-y-6">
      <Link href={`/guardian/invoices/${recordId(data)}`} className="text-sm font-semibold text-teal-700 underline">
        ← Back to invoice
      </Link>
      <h1 className="text-3xl font-bold">Pay {data.invoice_no}</h1>
      <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
        SIMULATED — no real money moves
      </p>

      <div className="space-y-4 rounded-2xl border bg-white p-6 shadow-sm">
        <label className="block text-sm font-semibold text-slate-700">
          Amount (rupees)
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount || (outstanding / 100).toFixed(2)}
            onChange={(event) => setAmount(event.target.value)}
            disabled={!canPay}
            className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:bg-slate-100"
          />
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Method
          <select
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            disabled={!canPay}
            className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:bg-slate-100"
          >
            <option value="SIMULATED_CARD">Card</option>
            <option value="SIMULATED_UPI">UPI</option>
          </select>
        </label>
        <label className="block text-sm font-semibold text-slate-700">
          Outcome
          <select
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
            disabled={!canPay}
            className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:bg-slate-100"
          >
            <option value="SUCCEEDED">Success</option>
            <option value="FAILED">Failure</option>
          </select>
        </label>

        {message && (
          <p aria-live="polite" className="rounded-lg bg-slate-100 p-3 text-sm font-medium text-slate-800">
            {message}
          </p>
        )}

        {isPaidOrVoid && (
          <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            This invoice is already {data.status.toLowerCase()}.
          </p>
        )}

        <button
          disabled={pay.isPending || !canPay}
          onClick={() => pay.mutate()}
          className="rounded-lg bg-teal-700 px-5 py-2 font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {pay.isPending ? 'Processing…' : 'Pay simulated'}
        </button>
      </div>
    </section>
  );
}

export function GuardianInvoices() {
  const invoices = useQuery({
    queryKey: ['guardian-invoices'],
    queryFn: () => apiRequest<{ data: Array<Invoice & { _id?: string }> }>('/invoices?pageSize=100'),
  });

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-slate-900">Invoices</h2>
      <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
        {invoices.isLoading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3">Invoice</th>
                <th scope="col" className="px-4 py-3">Period</th>
                <th scope="col" className="px-4 py-3">Due date</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(invoices.data?.data || []).length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500">
                    No invoices issued.
                  </td>
                </tr>
              ) : (
                (invoices.data?.data || []).map((raw) => {
                  const invoice = mapInvoice(raw);
                  return (
                    <tr key={invoice.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        <Link href={`/guardian/invoices/${invoice.id}`} className="text-teal-700 hover:underline">
                          {invoice.invoice_no}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{invoice.period_label}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(invoice.due_date)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge value={invoice.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-900">
                        {formatMoney(invoice.total_paise)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

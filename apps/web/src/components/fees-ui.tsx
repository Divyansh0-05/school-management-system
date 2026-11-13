'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, type ApiProblem } from '../lib/api';

type Invoice = { id: string; invoice_no: string; student_id: string; period_label: string; due_date: string; status: string; total_paise: number; invoice_items: Array<{ description: string; amount_paise: number }> };
type Payment = { id: string; amount_paise: number; method: string; status: string; receipt_no: string };
type Ledger = { id: string; invoice_id?: string; type: string; amount_paise: number; createdAt: string };
type ProblemError = Error & { problem?: ApiProblem };
const recordId = (value: { id?: string; _id?: string }) => value.id || value._id || '';
const rupees = (paise: number) => `₹${(paise / 100).toFixed(2)}`;
const friendly = (error: unknown, invoiceStatus?: string) => {
  const prob = (error as ProblemError).problem;
  const code = prob?.code || '';
  if (invoiceStatus === 'PAID' || prob?.detail?.toLowerCase().includes('already paid') || (prob?.status === 409 && invoiceStatus === 'PAID')) {
    return 'This invoice is already paid.';
  }
  const map: Record<string, string> = {
    INVOICE_HAS_PAYMENTS: 'This invoice has successful payments and cannot be voided.',
    INVALID_STATE_TRANSITION: invoiceStatus === 'PAID' ? 'This invoice is already paid.' : 'That action is not available for this invoice.',
    OVERPAYMENT: 'The payment is greater than the outstanding balance.',
    IDEMPOTENCY_KEY_REUSED: 'This payment attempt has already been processed with different details.',
  };
  return map[code] || prob?.detail || (error as Error).message || 'Request failed.';
};

function mapInvoice(value: Invoice & { _id?: string }) { return { ...value, id: recordId(value) }; }

export function AdminInvoices() {
  const [status, setStatus] = useState(''); const [open, setOpen] = useState(false); const [studentId, setStudentId] = useState(''); const [period, setPeriod] = useState(''); const [dueDate, setDueDate] = useState(''); const [amount, setAmount] = useState('');
  const query = useQuery({ queryKey: ['invoices', status], queryFn: () => apiRequest<{ data: Array<Invoice & { _id?: string }>; meta: { total: number } }>(`/invoices?pageSize=100${status ? `&status=${status}` : ''}`) });
  const students = useQuery({ queryKey: ['invoice-students'], queryFn: () => apiRequest<{ data: Array<{ id?: string; _id?: string; full_name?: string; fullName?: string }> }>('/students?pageSize=100') });
  const heads = useQuery({ queryKey: ['fee-heads'], queryFn: () => apiRequest<{ data: Array<{ id?: string; _id?: string; name: string }> }>('/fee-heads?pageSize=100') });
  const years = useQuery({ queryKey: ['invoice-years'], queryFn: () => apiRequest<{ data: Array<{ id?: string; _id?: string; is_current: boolean }> }>('/academic-years?pageSize=100') });
  const create = useMutation({ mutationFn: () => apiRequest('/invoices', { method: 'POST', body: JSON.stringify({ studentId, academicYearId: recordId(years.data?.data.find((year) => year.is_current) || {}), periodLabel: period, dueDate, items: [{ feeHeadId: heads.data?.data[0] && recordId(heads.data.data[0]), description: heads.data?.data[0]?.name || 'Fee', amountPaise: Math.round(Number(amount) * 100) }] }) }), onSuccess: () => { setOpen(false); query.refetch(); } });
  return <section><div className="flex items-end justify-between"><div><p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Fees</p><h1 className="mt-1 text-3xl font-bold">Invoices</h1></div><div className="flex gap-4"><button onClick={() => setOpen(!open)} className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white">Create invoice</button><Link href="/admin/reports/fees" className="self-center text-teal-700 underline">Fee reports</Link></div></div>{open && <form onSubmit={(event) => { event.preventDefault(); create.mutate(); }} className="mt-6 grid gap-3 rounded-2xl border bg-white p-5 sm:grid-cols-2"><label className="text-sm font-semibold">Student<select required value={studentId} onChange={(event) => setStudentId(event.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2"><option value="">Select student</option>{(students.data?.data || []).map((student) => <option key={recordId(student)} value={recordId(student)}>{student.full_name || student.fullName}</option>)}</select></label><label className="text-sm font-semibold">Period<input required value={period} onChange={(event) => setPeriod(event.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2" /></label><label className="text-sm font-semibold">Due date<input required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2" /></label><label className="text-sm font-semibold">Amount (rupees)<input required type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2" /></label><button disabled={create.isPending} className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white sm:col-span-2">Save draft</button></form>}<label className="mt-6 block max-w-xs text-sm font-semibold">Status<select value={status} onChange={(event) => setStatus(event.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2"><option value="">All statuses</option>{['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID'].map((item) => <option key={item}>{item}</option>)}</select></label><div className="mt-6 divide-y rounded-2xl border bg-white shadow-sm">{query.isLoading ? <p className="p-6">Loading invoices…</p> : (query.data?.data || []).map((raw) => { const invoice = mapInvoice(raw); return <Link key={invoice.id} href={`/admin/invoices/${invoice.id}`} className="grid gap-2 p-4 hover:bg-slate-50 sm:grid-cols-4"><span className="font-semibold">{invoice.invoice_no}</span><span>{invoice.period_label}</span><span>{rupees(invoice.total_paise)}</span><span className="font-semibold">{invoice.status}</span></Link>; })}</div></section>;
}

export function InvoiceDetail({ guardian = false }: { guardian?: boolean }) {
  const params = useParams<{ id: string }>(); const client = useQueryClient(); const [message, setMessage] = useState('');
  const invoice = useQuery({ queryKey: ['invoice', params.id], queryFn: async () => { const response = await apiRequest<{ data: Invoice & { _id?: string } }>(`/invoices/${params.id}`); return mapInvoice(response.data); } });
  const ledger = useQuery({ queryKey: ['ledger', invoice.data?.student_id], enabled: Boolean(invoice.data?.student_id), queryFn: () => apiRequest<{ data: Array<Ledger & { _id?: string }> }>(`/students/${invoice.data!.student_id}/ledger`) });
  const payments = useQuery({ queryKey: ['payments', params.id], queryFn: () => apiRequest<{ data: Array<Payment & { _id?: string }> }>(`/payments?invoiceId=${params.id}&pageSize=100`) });
  const action = useMutation({ mutationFn: (kind: 'issue' | 'void') => apiRequest(`/invoices/${params.id}/${kind}`, { method: 'POST', body: JSON.stringify({}) }), onSuccess: () => { setMessage('Invoice updated.'); client.invalidateQueries({ queryKey: ['invoice', params.id] }); client.invalidateQueries({ queryKey: ['ledger'] }); }, onError: (error) => setMessage(friendly(error)) });
  if (invoice.isLoading) return <p>Loading invoice…</p>; if (invoice.isError || !invoice.data) return <p role="alert">Invoice not found.</p>;
  const item = invoice.data;
  const paidPaise = (payments.data?.data || []).filter((payment) => payment.status === 'SUCCEEDED').reduce((sum, payment) => sum + payment.amount_paise, 0);
  const outstanding = Math.max(0, item.total_paise - paidPaise);
  return <section><Link href={guardian ? '/guardian' : '/admin/invoices'} className="text-teal-700 underline">Back</Link><div className="mt-4 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-bold">{item.invoice_no}</h1><p className="mt-1 text-slate-600">{item.period_label} · {rupees(item.total_paise)}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold">{item.status}</span></div>{message && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-800">{message}</p>} {!guardian && <div className="mt-5 flex gap-2">{item.status === 'DRAFT' && <button onClick={() => action.mutate('issue')} className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white">Issue</button>}{(item.status === 'DRAFT' || item.status === 'ISSUED') && <button onClick={() => { if (window.confirm('Void this invoice?')) action.mutate('void'); }} className="rounded-lg border border-red-300 px-4 py-2 font-semibold text-red-700">Void</button>}</div>}<div className="mt-6 grid gap-6 lg:grid-cols-2"><div className="rounded-2xl border bg-white p-5"><h2 className="font-bold">Items</h2>{(item.invoice_items || []).map((row) => <div key={row.description} className="flex justify-between border-b py-2"><span>{row.description}</span><span>{rupees(row.amount_paise)}</span></div>)}</div><div className="rounded-2xl border bg-white p-5"><h2 className="font-bold">Payments</h2>{(payments.data?.data || []).map((row) => <div key={recordId(row)} className="flex justify-between border-b py-2"><span>{row.receipt_no} · {row.status}</span><span>{rupees(row.amount_paise)}</span></div>)}</div></div><div className="mt-6 rounded-2xl border bg-white p-5"><h2 className="font-bold">Ledger</h2>{(ledger.data?.data || []).filter((row) => row.invoice_id === params.id || !row.invoice_id).map((row) => <div key={recordId(row)} className="flex justify-between border-b py-2"><span>{row.type}</span><span>{rupees(row.amount_paise)}</span></div>)}</div>{guardian && item.status !== 'PAID' && item.status !== 'VOID' && outstanding > 0 && <Link href={`/guardian/payments/${item.id}`} className="mt-6 inline-block rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white">Pay (simulated)</Link>}</section>;
}

export function SimulatedPayment() {
  const params = useParams<{ id: string }>(); const client = useQueryClient(); const [amount, setAmount] = useState(''); const [method, setMethod] = useState('SIMULATED_CARD'); const [outcome, setOutcome] = useState('SUCCEEDED'); const [message, setMessage] = useState('');
  const invoice = useQuery({ queryKey: ['invoice-pay', params.id], queryFn: () => apiRequest<{ data: Invoice & { _id?: string } }>(`/invoices/${params.id}`) });
  const payments = useQuery({ queryKey: ['payments', params.id], queryFn: () => apiRequest<{ data: Array<Payment & { _id?: string }> }>(`/payments?invoiceId=${params.id}&pageSize=100`) });
  const data = invoice.data?.data; const paidPaise = (payments.data?.data || []).filter((payment) => payment.status === 'SUCCEEDED').reduce((sum, payment) => sum + payment.amount_paise, 0); const outstanding = data ? Math.max(0, data.total_paise - paidPaise) : 0;
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
          body: JSON.stringify({ amountPaise: Math.round(Number(amount || outstanding / 100) * 100), method, simulatedStatus: outcome })
        });
      } finally {
        sessionStorage.removeItem(keyName);
      }
    },
    onSuccess: () => {
      setMessage(outcome === 'FAILED' ? 'Payment failed; your balance is unchanged.' : 'Payment recorded successfully.');
      client.invalidateQueries({ queryKey: ['invoice-pay', params.id] });
      client.invalidateQueries({ queryKey: ['invoice', params.id] });
      client.invalidateQueries({ queryKey: ['payments', params.id] });
      client.invalidateQueries({ queryKey: ['guardian-invoices'] });
      client.invalidateQueries({ queryKey: ['ledger'] });
    },
    onError: (error) => setMessage(friendly(error, data?.status))
  });
  if (invoice.isLoading || payments.isLoading) return <p>Loading payment…</p>; if (!data) return <p role="alert">Invoice not found.</p>;
  return <section className="max-w-xl"><Link href={`/guardian/invoices/${recordId(data)}`} className="text-teal-700 underline">Back to invoice</Link><h1 className="mt-4 text-3xl font-bold">Pay {data.invoice_no}</h1><p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 font-semibold">SIMULATED — no real money moves</p><label className="mt-6 block font-semibold">Amount (rupees)<input type="number" min="0.01" step="0.01" value={amount || (outstanding / 100).toFixed(2)} onChange={(event) => setAmount(event.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2" /></label><label className="mt-4 block font-semibold">Method<select value={method} onChange={(event) => setMethod(event.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2"><option value="SIMULATED_CARD">Card</option><option value="SIMULATED_UPI">UPI</option></select></label><label className="mt-4 block font-semibold">Outcome<select value={outcome} onChange={(event) => setOutcome(event.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2"><option value="SUCCEEDED">Success</option><option value="FAILED">Failure</option></select></label>{message && <p aria-live="polite" className="mt-4 rounded-lg bg-slate-100 p-3">{message}</p>}{isPaidOrVoid && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-emerald-800">This invoice is already {data.status.toLowerCase()}.</p>}<button disabled={pay.isPending || !canPay} onClick={() => pay.mutate()} className="mt-6 rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{pay.isPending ? 'Processing…' : 'Pay simulated'}</button></section>;
}

export function GuardianInvoices() {
  const invoices = useQuery({ queryKey: ['guardian-invoices'], queryFn: () => apiRequest<{ data: Array<Invoice & { _id?: string }> }>('/invoices?pageSize=100') });
  return <section className="mt-8"><h2 className="text-2xl font-bold">Invoices</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{(invoices.data?.data || []).map((raw) => { const invoice = mapInvoice(raw); return <Link key={invoice.id} href={`/guardian/invoices/${invoice.id}`} className="rounded-xl border bg-white p-4 hover:border-teal-500"><div className="flex justify-between"><span className="font-semibold">{invoice.invoice_no}</span><span>{invoice.status}</span></div><p className="mt-2 text-slate-600">{invoice.period_label} · {rupees(invoice.total_paise)}</p></Link>; })}</div></section>;
}

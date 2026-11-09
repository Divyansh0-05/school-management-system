'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, type ApiProblem } from '../lib/api';

type Section = { _id: string; name: string; class_id?: string; academic_year_id?: string };
type Student = { _id?: string; id?: string; admission_no?: string; admissionNo?: string; full_name?: string; fullName?: string; enrollment?: { roll_no?: number } };
type AttendanceRow = { student: Student; attendance: { status: Status } | null };
type Status = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
type Summary = { present: number; absent: number; late: number; excused: number; marked: number; percentageHundredths: number; percentage: string; absentDates: string[] };
type SectionSummary = Summary & { studentId: string };

const statuses: Array<{ value: Status; label: string }> = [
  { value: 'PRESENT', label: 'Present' }, { value: 'ABSENT', label: 'Absent' },
  { value: 'LATE', label: 'Late' }, { value: 'EXCUSED', label: 'Excused' },
];

export function today() {
  return new Date().toISOString().slice(0, 10);
}

function problem(error: unknown) {
  return (error as Error & { problem?: ApiProblem }).problem;
}

function studentId(student: Student) { return student._id || student.id || ''; }
function studentName(student: Student) { return student.full_name || student.fullName || 'Student'; }
function studentAdmission(student: Student) { return student.admission_no || student.admissionNo || '—'; }

export function SectionCards({ sections, basePath }: { sections: Section[]; basePath: string }) {
  if (!sections.length) return <p className="rounded-xl border bg-white p-6 text-slate-600">No assigned sections found.</p>;
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{sections.map((section) => <Link key={section._id} href={`${basePath}/${section._id}`} className="rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-600"><p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Section</p><h2 className="mt-1 text-xl font-bold">{section.name}</h2><p className="mt-2 text-sm text-slate-500">Open attendance sheet</p></Link>)}</div>;
}

export function TeacherSections({ basePath = '/teacher/sections' }: { basePath?: string }) {
  const query = useQuery({ queryKey: ['attendance-sections'], queryFn: () => apiRequest<{ data: Section[] }>('/sections') });
  return <section><p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Attendance</p><h1 className="mt-1 text-3xl font-bold">My classes</h1><p className="mt-2 text-slate-600">Record attendance for sections assigned to you.</p>{query.isLoading ? <div className="mt-8 h-32 animate-pulse rounded-2xl bg-slate-200" /> : query.isError ? <RetryState onRetry={() => query.refetch()} /> : <div className="mt-8"><SectionCards sections={query.data?.data || []} basePath={basePath} /></div>}</section>;
}

function RetryState({ onRetry }: { onRetry: () => void }) {
  return <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-6 text-red-800"><p role="alert">Could not load attendance data.</p><button onClick={onRetry} className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-red-600">Retry</button></div>;
}

export function AttendanceSheet({ admin = false }: { admin?: boolean }) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const client = useQueryClient();
  const [date, setDate] = useState(today());
  const [session, setSession] = useState<'MORNING' | 'AFTERNOON'>('MORNING');
  const [statusesByStudent, setStatusesByStudent] = useState<Record<string, Status>>({});
  const [savedStatuses, setSavedStatuses] = useState<Record<string, Status>>({});
  const [message, setMessage] = useState('');
  const [range, setRange] = useState({ from: today(), to: today() });
  const sectionQuery = useQuery({ queryKey: ['attendance-section', params.id], queryFn: async () => {
    const response = await apiRequest<{ data: Section[] }>('/sections');
    const section = response.data.find((item) => item._id === params.id);
    if (!section) throw Object.assign(new Error('Section not found'), { problem: { status: 404 } });
    return { data: section };
  }, retry: false });
  const sheetQuery = useQuery({ queryKey: ['attendance-sheet', params.id, date, session], queryFn: () => apiRequest<{ data: AttendanceRow[] }>(`/sections/${params.id}/attendance?date=${date}&session=${session}`), retry: false });
  const summaryQuery = useQuery({ queryKey: ['attendance-summary', params.id, range], queryFn: () => apiRequest<{ data: SectionSummary[] }>(`/reports/attendance/section?sectionId=${params.id}&from=${range.from}&to=${range.to}`), enabled: Boolean(range.from && range.to) });

  useEffect(() => {
    if (sectionQuery.error && problem(sectionQuery.error)?.status === 404) router.replace('/404');
  }, [router, sectionQuery.error]);
  useEffect(() => {
    const next: Record<string, Status> = {};
    (sheetQuery.data?.data || []).forEach((row) => { if (row.attendance) next[studentId(row.student)] = row.attendance.status; });
    setStatusesByStudent(next);
    setSavedStatuses(next);
    setMessage('');
  }, [sheetQuery.data]);
  const rows = sheetQuery.data?.data || [];
  const dirty = JSON.stringify(statusesByStudent) !== JSON.stringify(savedStatuses);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  const save = useMutation({
    mutationFn: () => apiRequest(`/sections/${params.id}/attendance`, { method: 'PUT', body: JSON.stringify({ date, session, records: rows.map((row) => ({ studentId: studentId(row.student), status: statusesByStudent[studentId(row.student)] || 'PRESENT' })) }) }),
    onSuccess: () => { setSavedStatuses(statusesByStudent); setMessage('Attendance saved successfully.'); client.invalidateQueries({ queryKey: ['attendance-sheet', params.id] }); },
    onError: (error) => { const details = problem(error); setMessage(details?.code === 'EDIT_WINDOW_CLOSED' ? 'The teacher edit window is closed for this date.' : details?.status === 422 ? 'Please check the attendance entries and try again.' : 'Could not save attendance. Please retry.'); },
  });
  const counts = useMemo(() => Object.values(statusesByStudent).reduce((result, value) => ({ ...result, [value]: result[value] + 1 }), { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 }), [statusesByStudent]);
  const setStatus = (id: string, value: Status) => setStatusesByStudent((current) => ({ ...current, [id]: value }));
  return <section>
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Attendance</p><h1 className="mt-1 text-3xl font-bold">Section attendance{sectionQuery.data?.data.name ? `: ${sectionQuery.data.data.name}` : ''}</h1><p className="mt-2 text-slate-600">Mark one status for every enrolled student.</p></div><Link href={admin ? '/admin/attendance' : '/teacher'} className="text-teal-700 underline">Back to classes</Link></div>
    <div className="mt-6 grid gap-4 rounded-2xl border bg-white p-4 shadow-sm sm:grid-cols-3"><label className="text-sm font-semibold">Date<input aria-label="Attendance date" type="date" max={today()} value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-600" /></label><label className="text-sm font-semibold">Session<select aria-label="Attendance session" value={session} onChange={(event) => setSession(event.target.value as 'MORNING' | 'AFTERNOON')} className="mt-1 block w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-600"><option value="MORNING">Morning</option><option value="AFTERNOON">Afternoon</option></select></label><div className="flex items-end"><button onClick={() => setStatusesByStudent(Object.fromEntries(rows.map((row) => [studentId(row.student), 'PRESENT'])))} disabled={!rows.length} className="w-full rounded-lg border border-teal-700 px-3 py-2 font-semibold text-teal-800 hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-600">Mark all present</button></div></div>
    {sheetQuery.isLoading ? <div className="mt-6 h-48 animate-pulse rounded-2xl bg-slate-200" /> : sheetQuery.isError ? <RetryState onRetry={() => sheetQuery.refetch()} /> : rows.length === 0 ? <p className="mt-6 rounded-xl border bg-white p-6 text-slate-600">No students are enrolled in this section for the current academic year.</p> : <><div className="mt-6 flex flex-wrap gap-3 text-sm" aria-live="polite"><span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-900">Present {counts.PRESENT}</span><span className="rounded-full bg-red-100 px-3 py-1 text-red-900">Absent {counts.ABSENT}</span><span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900">Late {counts.LATE}</span><span className="rounded-full bg-slate-200 px-3 py-1 text-slate-900">Excused {counts.EXCUSED}</span></div><div className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm"><div className="divide-y">{rows.map((row) => { const id = studentId(row.student); return <div key={id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{studentName(row.student)}</p><p className="text-sm text-slate-500">{studentAdmission(row.student)}{row.student.enrollment?.roll_no ? ` · Roll ${row.student.enrollment.roll_no}` : ''}</p></div><label className="text-sm font-semibold">Status<select aria-label={`Status for ${studentName(row.student)}`} value={statusesByStudent[id] || 'PRESENT'} onChange={(event) => setStatus(id, event.target.value as Status)} className="mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-600 sm:w-40">{statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label></div>; })}</div></div><div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-600" aria-live="polite">{message || `${rows.length} students · ${dirty ? 'Unsaved changes' : 'All changes saved'}`}</p><button onClick={() => save.mutate()} disabled={save.isPending || !dirty} className="rounded-lg bg-teal-700 px-5 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-teal-600">{save.isPending ? 'Saving…' : 'Save attendance'}</button></div></>}
    <div className="mt-10 rounded-2xl border bg-white p-4 shadow-sm"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 className="text-xl font-bold">Section summary</h2><p className="text-sm text-slate-600">Attendance totals for a date range.</p></div><div className="flex gap-2"><label className="text-xs font-semibold">From<input aria-label="Summary from" type="date" max={today()} value={range.from} onChange={(event) => setRange({ ...range, from: event.target.value })} className="mt-1 block rounded border px-2 py-1" /></label><label className="text-xs font-semibold">To<input aria-label="Summary to" type="date" max={today()} value={range.to} onChange={(event) => setRange({ ...range, to: event.target.value })} className="mt-1 block rounded border px-2 py-1" /></label></div></div>{summaryQuery.isLoading ? <div className="mt-4 h-16 animate-pulse rounded bg-slate-100" /> : summaryQuery.isError ? <RetryState onRetry={() => summaryQuery.refetch()} /> : <div className="mt-4 space-y-2">{(summaryQuery.data?.data || []).map((item) => <div key={item.studentId} className="rounded-lg bg-slate-50 p-3 text-sm"><span className="font-semibold">{item.studentId}</span><span className="ml-3 text-slate-600">{item.present} present · {item.absent} absent · {item.late} late · {item.percentage}</span></div>)}</div>}</div>
  </section>;
}

export function AdminAttendance() {
  const query = useQuery({ queryKey: ['attendance-sections-admin'], queryFn: () => apiRequest<{ data: Section[] }>('/sections') });
  return <section><p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Attendance</p><h1 className="mt-1 text-3xl font-bold">All sections</h1><p className="mt-2 text-slate-600">Review and manage attendance for any section.</p><div className="mt-8">{query.isLoading ? <div className="h-32 animate-pulse rounded-2xl bg-slate-200" /> : query.isError ? <RetryState onRetry={() => query.refetch()} /> : <SectionCards sections={query.data?.data || []} basePath="/admin/attendance" />}</div></section>;
}

export function GuardianChildren() {
  const query = useQuery({ queryKey: ['guardian-students'], queryFn: () => apiRequest<{ data: Student[] }>('/students') });
  const [range] = useState({ from: today(), to: today() });
  if (query.isLoading) return <div className="h-32 animate-pulse rounded-2xl bg-slate-200" />;
  if (query.isError) return <RetryState onRetry={() => query.refetch()} />;
  return <div className="grid gap-4 sm:grid-cols-2">{(query.data?.data || []).map((student) => <ChildCard key={studentId(student)} student={student} range={range} />)}</div>;
}

function ChildCard({ student, range }: { student: Student; range: { from: string; to: string } }) {
  const query = useQuery({ queryKey: ['child-summary', studentId(student), range], queryFn: () => apiRequest<{ data: Summary }>(`/students/${studentId(student)}/attendance-summary?from=${range.from}&to=${range.to}`) });
  return <article className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-bold">{studentName(student)}</h2><p className="mt-1 text-sm text-slate-500">{studentAdmission(student)}</p>{query.isLoading ? <div className="mt-4 h-10 animate-pulse rounded bg-slate-100" /> : query.isError ? <p className="mt-4 text-sm text-red-700">Could not load attendance summary.</p> : <p className="mt-4 text-sm text-slate-700">{query.data?.data.present} present · {query.data?.data.absent} absent · {query.data?.data.late} late · <strong>{query.data?.data.percentage}</strong></p>}</article>;
}

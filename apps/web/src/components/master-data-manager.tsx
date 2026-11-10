'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { MasterBodySchemas, type MasterResource, z } from '@school/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { apiRequest, type ApiProblem } from '../lib/api';
import { useToast } from './toast';

type Field = { key: string; label: string; type?: 'text' | 'number' | 'date' | 'email' | 'textarea' | 'checkbox' };
const configs: Record<MasterResource, { label: string; fields: Field[]; columns: string[] }> = {
  students: { label: 'Students', fields: [{ key: 'admission_no', label: 'Admission number' }, { key: 'full_name', label: 'Full name' }, { key: 'dob', label: 'Date of birth', type: 'date' }, { key: 'gender', label: 'Gender' }, { key: 'status', label: 'Status' }], columns: ['admission_no', 'full_name', 'gender', 'status'] },
  guardians: { label: 'Guardians', fields: [{ key: 'email', label: 'Email', type: 'email' }, { key: 'full_name', label: 'Full name' }, { key: 'phone', label: 'Phone' }, { key: 'temporary_password', label: 'Temporary password' }], columns: ['full_name', 'phone', 'user_id'] },
  teachers: { label: 'Teachers', fields: [{ key: 'email', label: 'Email', type: 'email' }, { key: 'employee_no', label: 'Employee number' }, { key: 'full_name', label: 'Full name' }, { key: 'phone', label: 'Phone' }, { key: 'temporary_password', label: 'Temporary password' }], columns: ['employee_no', 'full_name', 'phone'] },
  classes: { label: 'Classes', fields: [{ key: 'name', label: 'Name' }, { key: 'level', label: 'Level', type: 'number' }], columns: ['name', 'level'] },
  sections: { label: 'Sections', fields: [{ key: 'class_id', label: 'Class ID' }, { key: 'academic_year_id', label: 'Academic year ID' }, { key: 'name', label: 'Name' }], columns: ['name', 'class_id', 'academic_year_id'] },
  subjects: { label: 'Subjects', fields: [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Name' }], columns: ['code', 'name'] },
  'academic-years': { label: 'Academic years', fields: [{ key: 'name', label: 'Name' }, { key: 'start_date', label: 'Start date', type: 'date' }, { key: 'end_date', label: 'End date', type: 'date' }, { key: 'is_current', label: 'Current', type: 'checkbox' }], columns: ['name', 'start_date', 'end_date', 'is_current'] },
  enrollments: { label: 'Enrollments', fields: [{ key: 'student_id', label: 'Student ID' }, { key: 'section_id', label: 'Section ID' }, { key: 'academic_year_id', label: 'Academic year ID' }, { key: 'roll_no', label: 'Roll number', type: 'number' }], columns: ['student_id', 'section_id', 'roll_no'] },
  'teacher-assignments': { label: 'Teacher assignments', fields: [{ key: 'teacher_id', label: 'Teacher ID' }, { key: 'section_id', label: 'Section ID' }, { key: 'subject_id', label: 'Subject ID' }, { key: 'is_class_teacher', label: 'Class teacher', type: 'checkbox' }], columns: ['teacher_id', 'section_id', 'subject_id', 'is_class_teacher'] },
  'class-subjects': { label: 'Class subjects', fields: [{ key: 'class_id', label: 'Class ID' }, { key: 'subject_id', label: 'Subject ID' }], columns: ['class_id', 'subject_id'] },
  'fee-heads': { label: 'Fee heads', fields: [{ key: 'name', label: 'Name' }], columns: ['name'] },
  'grading-schemes': { label: 'Grading schemes', fields: [{ key: 'name', label: 'Name' }, { key: 'is_default', label: 'Default', type: 'checkbox' }, { key: 'grading_bands', label: 'Bands JSON', type: 'textarea' }], columns: ['name', 'is_default', 'grading_bands'] },
};

function display(value: unknown) {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function rowId(row: Record<string, unknown>) {
  return String(row.id || row._id || '');
}

function normalizeRow(row: Record<string, unknown>) {
  const aliases: Record<string, string> = {
    admissionNo: 'admission_no',
    fullName: 'full_name',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    isActive: 'is_active',
    isCurrent: 'is_current',
    startDate: 'start_date',
    endDate: 'end_date',
    userId: 'user_id',
  };
  return Object.entries(row).reduce<Record<string, unknown>>((normalized, [key, value]) => {
    normalized[aliases[key] || key] = value;
    return normalized;
  }, {});
}

export function MasterDataManager({ resource }: { resource: MasterResource }) {
  const config = configs[resource];
  const notify = useToast();
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<'create' | 'edit' | null>(null);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [confirm, setConfirm] = useState<Record<string, unknown> | null>(null);
  const schema = MasterBodySchemas[resource] as z.ZodType<Record<string, unknown>>;
  const query = useQuery({ queryKey: ['master', resource, page, search], queryFn: () => apiRequest<{ data: Record<string, unknown>[]; meta: { page: number; pageSize: number; total: number; totalPages: number } }>(`/${resource}?page=${page}&pageSize=10&q=${encodeURIComponent(search)}`) });
  const form = useForm<Record<string, unknown>>({ resolver: zodResolver(schema), defaultValues: {} });
  const mutation = useMutation({
    mutationFn: (input: Record<string, unknown>) => apiRequest(`/${resource}${selected ? `/${rowId(selected)}` : ''}`, { method: selected ? 'PATCH' : 'POST', body: JSON.stringify(input) }),
    onSuccess: () => { client.invalidateQueries({ queryKey: ['master', resource] }); notify(selected ? 'Record updated' : 'Record created'); setDialog(null); form.reset({}); },
    onError: (error) => notify((error as Error & { problem?: ApiProblem }).problem?.detail || 'Request failed', 'error'),
  });
  const deactivate = useMutation({
    mutationFn: (id: string) => apiRequest(`/${resource}/${id}`, { method: 'DELETE' }),
    onSuccess: () => { client.invalidateQueries({ queryKey: ['master', resource] }); notify('Record deactivated'); setConfirm(null); },
    onError: (error) => notify((error as Error & { problem?: ApiProblem }).problem?.detail || 'Could not deactivate record', 'error'),
  });
  const rows = (query.data?.data || []).map(normalizeRow);
  const totalPages = query.data?.meta.totalPages || 1;
  const openCreate = () => { setSelected(null); form.reset({}); setDialog('create'); };
  const openEdit = (row: Record<string, unknown>) => { setSelected(row); form.reset({ ...row, grading_bands: Array.isArray(row.grading_bands) ? JSON.stringify(row.grading_bands, null, 2) : row.grading_bands }); setDialog('edit'); };
  const submit = (values: Record<string, unknown>) => {
    const input = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== '' && !Number.isNaN(value)));
    if (resource === 'grading-schemes' && typeof input.grading_bands === 'string') input.grading_bands = JSON.parse(input.grading_bands);
    mutation.mutate(input);
  };
  const errors = useMemo(() => form.formState.errors, [form.formState.errors]);
  return <section>
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Admin master data</p><h1 className="mt-1 text-3xl font-bold">{config.label}</h1></div><button onClick={openCreate} className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white">Create</button></div>
    <div className="mt-6 flex gap-2"><label className="sr-only" htmlFor="master-search">Search {config.label}</label><input id="master-search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (setPage(1), setSearch(q))} placeholder="Search and press Enter" className="w-full max-w-md rounded-lg border px-3 py-2" /><button onClick={() => { setPage(1); setSearch(q); }} className="rounded-lg border bg-white px-4 py-2">Search</button></div>
    <div className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">{query.isLoading ? <div className="space-y-3 p-6">{[1, 2, 3].map((item) => <div key={item} className="h-10 animate-pulse rounded bg-slate-100" />)}</div> : query.isError ? <div className="p-8 text-center"><p role="alert" className="text-red-700">Could not load {config.label.toLowerCase()}.</p><button onClick={() => query.refetch()} className="mt-3 text-teal-700 underline">Retry</button></div> : rows.length === 0 ? <p className="p-8 text-center text-slate-500">No records found.</p> : <table className="responsive-table w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{config.columns.map((column) => <th key={column} className="px-4 py-3">{column.replaceAll('_', ' ')}</th>)}<th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row, index) => <tr key={rowId(row) || index}>{config.columns.map((column) => <td data-label={column.replaceAll('_', ' ')} key={column} className="px-4 py-3">{display(row[column])}</td>)}<td data-label="Actions" className="px-4 py-3"><button onClick={() => openEdit(row)} className="mr-3 text-teal-700 underline">Edit</button><button onClick={() => setConfirm(row)} className="text-red-700 underline">Deactivate</button></td></tr>)}</tbody></table>}</div>
    <div className="mt-4 flex items-center justify-between text-sm"><span className="text-slate-600">{query.data?.meta.total || 0} records</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded border bg-white px-3 py-1 disabled:opacity-40">Previous</button><span className="px-2 py-1">Page {page} of {totalPages}</span><button disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)} className="rounded border bg-white px-3 py-1 disabled:opacity-40">Next</button></div></div>
    {dialog && <div role="dialog" aria-modal="true" aria-labelledby="master-dialog-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onKeyDown={(e) => e.key === 'Escape' && setDialog(null)}><form onSubmit={form.handleSubmit(submit)} className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6"><h2 id="master-dialog-title" className="text-xl font-bold">{dialog === 'create' ? 'Create' : 'Edit'} {config.label.slice(0, -1)}</h2>{config.fields.map((field) => { const error = errors[field.key]; const options = field.type === 'number' ? { valueAsNumber: true } : { setValueAs: (value: string) => value === '' ? undefined : value }; return <label key={field.key} className="block text-sm font-medium">{field.label}{field.type === 'checkbox' ? <input type="checkbox" {...form.register(field.key)} className="ml-3 h-4 w-4" /> : field.type === 'textarea' ? <textarea {...form.register(field.key, options)} aria-describedby={`${field.key}-error`} rows={6} className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-xs" /> : <input {...form.register(field.key, options)} type={field.type || 'text'} aria-describedby={`${field.key}-error`} className="mt-1 w-full rounded-lg border px-3 py-2" />}{error && <span id={`${field.key}-error`} className="mt-1 block text-xs text-red-700">{String(error.message)}</span>}</label>; })}{mutation.isError && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">{(mutation.error as Error).message}</p>}<div className="flex justify-end gap-3"><button type="button" onClick={() => setDialog(null)} className="rounded-lg border px-4 py-2">Cancel</button><button disabled={mutation.isPending} className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{mutation.isPending ? 'Saving…' : 'Save'}</button></div></form></div>}
    {confirm && <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6"><h2 id="confirm-title" className="text-xl font-bold">Deactivate record?</h2><p className="mt-2 text-sm text-slate-600">This cannot be undone. Referenced records will be rejected by the API.</p><div className="mt-6 flex justify-end gap-3"><button onClick={() => setConfirm(null)} className="rounded-lg border px-4 py-2">Cancel</button><button onClick={() => deactivate.mutate(rowId(confirm))} disabled={deactivate.isPending} className="rounded-lg bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-50">Deactivate</button></div></div></div>}
  </section>;
}

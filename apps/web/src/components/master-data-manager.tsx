'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { MasterBodySchemas, type MasterResource, z } from '@school/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { apiRequest, type ApiProblem } from '../lib/api';
import { useToast } from './toast';

type Field = { key: string; label: string; type?: 'text' | 'number' | 'date' | 'email' | 'textarea' | 'checkbox' };
const configs: Record<MasterResource, { label: string; subtitle: string; fields: Field[]; columns: string[] }> = {
  students: {
    label: 'Students',
    subtitle: 'Manage student records, demographics, and enrollment statuses.',
    fields: [
      { key: 'admission_no', label: 'Admission number' },
      { key: 'full_name', label: 'Full name' },
      { key: 'dob', label: 'Date of birth', type: 'date' },
      { key: 'gender', label: 'Gender' },
      { key: 'status', label: 'Status' },
    ],
    columns: ['admission_no', 'full_name', 'gender', 'status'],
  },
  guardians: {
    label: 'Guardians',
    subtitle: 'Manage parent and guardian contact details and portal credentials.',
    fields: [
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'full_name', label: 'Full name' },
      { key: 'phone', label: 'Phone' },
      { key: 'temporary_password', label: 'Temporary password' },
    ],
    columns: ['full_name', 'phone', 'user_id'],
  },
  teachers: {
    label: 'Teachers',
    subtitle: 'Manage faculty profiles, employee IDs, and account credentials.',
    fields: [
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'employee_no', label: 'Employee number' },
      { key: 'full_name', label: 'Full name' },
      { key: 'phone', label: 'Phone' },
      { key: 'temporary_password', label: 'Temporary password' },
    ],
    columns: ['employee_no', 'full_name', 'phone'],
  },
  classes: {
    label: 'Classes',
    subtitle: 'Manage academic grade levels and grade hierarchies.',
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'level', label: 'Level', type: 'number' },
    ],
    columns: ['name', 'level'],
  },
  sections: {
    label: 'Sections',
    subtitle: 'Manage classroom sections for each class and academic year.',
    fields: [
      { key: 'class_id', label: 'Class' },
      { key: 'academic_year_id', label: 'Academic year' },
      { key: 'name', label: 'Section name' },
    ],
    columns: ['name', 'class_id', 'academic_year_id'],
  },
  subjects: {
    label: 'Subjects',
    subtitle: 'Manage curriculum subjects and subject codes.',
    fields: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Name' },
    ],
    columns: ['code', 'name'],
  },
  'academic-years': {
    label: 'Academic years',
    subtitle: 'Manage school calendar sessions and active terms.',
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'start_date', label: 'Start date', type: 'date' },
      { key: 'end_date', label: 'End date', type: 'date' },
      { key: 'is_current', label: 'Current session', type: 'checkbox' },
    ],
    columns: ['name', 'start_date', 'end_date', 'is_current'],
  },
  enrollments: {
    label: 'Enrollments',
    subtitle: 'Manage student classroom assignments and roll numbers.',
    fields: [
      { key: 'student_id', label: 'Student' },
      { key: 'section_id', label: 'Section' },
      { key: 'academic_year_id', label: 'Academic year' },
      { key: 'roll_no', label: 'Roll number', type: 'number' },
    ],
    columns: ['student_id', 'section_id', 'roll_no'],
  },
  'teacher-assignments': {
    label: 'Teacher assignments',
    subtitle: 'Assign instructors to specific sections, subjects, and class teacher roles.',
    fields: [
      { key: 'teacher_id', label: 'Teacher' },
      { key: 'section_id', label: 'Section' },
      { key: 'subject_id', label: 'Subject' },
      { key: 'is_class_teacher', label: 'Class teacher', type: 'checkbox' },
    ],
    columns: ['teacher_id', 'section_id', 'subject_id', 'is_class_teacher'],
  },
  'class-subjects': {
    label: 'Class subjects',
    subtitle: 'Map curriculum subjects taught within each class level.',
    fields: [
      { key: 'class_id', label: 'Class' },
      { key: 'subject_id', label: 'Subject' },
    ],
    columns: ['class_id', 'subject_id'],
  },
  'fee-heads': {
    label: 'Fee heads',
    subtitle: 'Configure fee components and billing categories.',
    fields: [{ key: 'name', label: 'Name' }],
    columns: ['name'],
  },
  'grading-schemes': {
    label: 'Grading schemes',
    subtitle: 'Configure letter grades, percentage thresholds, and GPA points.',
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'is_default', label: 'Default scheme', type: 'checkbox' },
      { key: 'grading_bands', label: 'Bands JSON', type: 'textarea' },
    ],
    columns: ['name', 'is_default', 'grading_bands'],
  },
};

function display(value: unknown) {
  if (value === undefined || value === null) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function columnLabel(column: string) {
  const map: Record<string, string> = {
    class_id: 'Class',
    section_id: 'Section',
    subject_id: 'Subject',
    teacher_id: 'Teacher',
    student_id: 'Student',
    academic_year_id: 'Academic year',
    user_id: 'User ID',
    admission_no: 'Admission no',
    employee_no: 'Employee no',
    full_name: 'Full name',
    dob: 'Date of birth',
    is_class_teacher: 'Class teacher',
    is_default: 'Default',
    is_current: 'Current',
    start_date: 'Start date',
    end_date: 'End date',
    grading_bands: 'Grading bands',
  };
  return map[column] || column.replaceAll('_', ' ');
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

  const teachersQuery = useQuery({
    queryKey: ['lookup', 'teachers'],
    queryFn: () =>
      apiRequest<{
        data: Array<{ _id?: string; id?: string; full_name?: string; fullName?: string; employee_no?: string; employeeNo?: string }>;
      }>('/teachers?pageSize=100'),
    staleTime: 60000,
  });

  const studentsQuery = useQuery({
    queryKey: ['lookup', 'students'],
    queryFn: () =>
      apiRequest<{
        data: Array<{ _id?: string; id?: string; full_name?: string; fullName?: string; admission_no?: string; admissionNo?: string }>;
      }>('/students?pageSize=100'),
    staleTime: 60000,
  });

  const classesQuery = useQuery({
    queryKey: ['lookup', 'classes'],
    queryFn: () =>
      apiRequest<{ data: Array<{ _id?: string; id?: string; name: string }> }>('/classes?pageSize=100'),
    staleTime: 60000,
  });

  const sectionsQuery = useQuery({
    queryKey: ['lookup', 'sections'],
    queryFn: () =>
      apiRequest<{
        data: Array<{ _id?: string; id?: string; name: string; class_id?: string; classId?: string }>;
      }>('/sections?pageSize=100'),
    staleTime: 60000,
  });

  const subjectsQuery = useQuery({
    queryKey: ['lookup', 'subjects'],
    queryFn: () =>
      apiRequest<{ data: Array<{ _id?: string; id?: string; name: string; code?: string }> }>('/subjects?pageSize=100'),
    staleTime: 60000,
  });

  const academicYearsQuery = useQuery({
    queryKey: ['lookup', 'academic-years'],
    queryFn: () =>
      apiRequest<{ data: Array<{ _id?: string; id?: string; name: string }> }>('/academic-years?pageSize=100'),
    staleTime: 60000,
  });

  const classMap = useMemo(() => {
    const map = new Map<string, string>();
    (classesQuery.data?.data || []).forEach((c) => {
      const id = String(c.id || c._id || '');
      if (id) map.set(id, c.name);
    });
    return map;
  }, [classesQuery.data]);

  const lookupMaps = useMemo(() => {
    const teacherMap = new Map<string, string>();
    (teachersQuery.data?.data || []).forEach((t) => {
      const id = String(t.id || t._id || '');
      const name = t.full_name || t.fullName || 'Teacher';
      const emp = t.employee_no || t.employeeNo;
      if (id) teacherMap.set(id, emp ? `${name} (${emp})` : name);
    });

    const studentMap = new Map<string, string>();
    (studentsQuery.data?.data || []).forEach((s) => {
      const id = String(s.id || s._id || '');
      const name = s.full_name || s.fullName || 'Student';
      const adm = s.admission_no || s.admissionNo;
      if (id) studentMap.set(id, adm ? `${name} (${adm})` : name);
    });

    const classNames = new Map<string, string>();
    (classesQuery.data?.data || []).forEach((c) => {
      const id = String(c.id || c._id || '');
      if (id) classNames.set(id, c.name);
    });

    const sectionMap = new Map<string, string>();
    (sectionsQuery.data?.data || []).forEach((s) => {
      const id = String(s.id || s._id || '');
      const cId = String(s.class_id || s.classId || '');
      const className = classNames.get(cId) || 'Class';
      if (id) sectionMap.set(id, `${className} - ${s.name}`);
    });

    const subjectMap = new Map<string, string>();
    (subjectsQuery.data?.data || []).forEach((s) => {
      const id = String(s.id || s._id || '');
      if (id) subjectMap.set(id, s.name);
    });

    const yearMap = new Map<string, string>();
    (academicYearsQuery.data?.data || []).forEach((y) => {
      const id = String(y.id || y._id || '');
      if (id) yearMap.set(id, y.name);
    });

    return {
      teacher_id: teacherMap,
      student_id: studentMap,
      class_id: classNames,
      section_id: sectionMap,
      subject_id: subjectMap,
      academic_year_id: yearMap,
    };
  }, [teachersQuery.data, studentsQuery.data, classesQuery.data, sectionsQuery.data, subjectsQuery.data, academicYearsQuery.data]);

  const dropdownOptions = useMemo(() => {
    return {
      teacher_id: (teachersQuery.data?.data || []).map((t) => {
        const id = String(t.id || t._id || '');
        const name = t.full_name || t.fullName || 'Teacher';
        const emp = t.employee_no || t.employeeNo;
        return { id, label: emp ? `${name} (${emp})` : name };
      }),
      student_id: (studentsQuery.data?.data || []).map((s) => {
        const id = String(s.id || s._id || '');
        const name = s.full_name || s.fullName || 'Student';
        const adm = s.admission_no || s.admissionNo;
        return { id, label: adm ? `${name} (${adm})` : name };
      }),
      class_id: (classesQuery.data?.data || []).map((c) => ({
        id: String(c.id || c._id || ''),
        label: c.name,
      })),
      section_id: (sectionsQuery.data?.data || []).map((s) => {
        const id = String(s.id || s._id || '');
        const cId = String(s.class_id || s.classId || '');
        const className = classMap.get(cId) || 'Class';
        return { id, label: `${className} - ${s.name}` };
      }),
      subject_id: (subjectsQuery.data?.data || []).map((s) => ({
        id: String(s.id || s._id || ''),
        label: s.name,
      })),
      academic_year_id: (academicYearsQuery.data?.data || []).map((y) => ({
        id: String(y.id || y._id || ''),
        label: y.name,
      })),
    };
  }, [teachersQuery.data, studentsQuery.data, classesQuery.data, sectionsQuery.data, subjectsQuery.data, academicYearsQuery.data, classMap]);

  function getDisplayValue(column: string, value: unknown) {
    if (value === undefined || value === null) return '—';
    if (column.endsWith('_id')) {
      const map = lookupMaps[column as keyof typeof lookupMaps];
      if (map) {
        const mapped = map.get(String(value));
        if (mapped) return mapped;
      }
    }
    return display(value);
  }

  const query = useQuery({
    queryKey: ['master', resource, page, search],
    queryFn: () =>
      apiRequest<{
        data: Record<string, unknown>[];
        meta: { page: number; pageSize: number; total: number; totalPages: number };
      }>(`/${resource}?page=${page}&pageSize=10&q=${encodeURIComponent(search)}`),
  });

  const form = useForm<Record<string, unknown>>({ resolver: zodResolver(schema), defaultValues: {} });

  const mutation = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      apiRequest(`/${resource}${selected ? `/${rowId(selected)}` : ''}`, {
        method: selected ? 'PATCH' : 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['master', resource] });
      client.invalidateQueries({ queryKey: ['lookup'] });
      notify(selected ? 'Record updated successfully' : 'Record created successfully');
      setDialog(null);
      form.reset({});
    },
    onError: (error) =>
      notify(
        (error as Error & { problem?: ApiProblem }).problem?.detail ||
          (error as Error).message ||
          'Could not save record. Please check the entered values.',
        'error'
      ),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => apiRequest(`/${resource}/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['master', resource] });
      client.invalidateQueries({ queryKey: ['lookup'] });
      notify('Record deactivated successfully');
      setConfirm(null);
    },
    onError: (error) =>
      notify(
        (error as Error & { problem?: ApiProblem }).problem?.detail ||
          (error as Error).message ||
          'Could not deactivate record.',
        'error'
      ),
  });

  const rows = (query.data?.data || []).map(normalizeRow);
  const totalPages = query.data?.meta?.totalPages || 1;

  const openCreate = () => {
    setSelected(null);
    form.reset({});
    setDialog('create');
  };

  const openEdit = (row: Record<string, unknown>) => {
    setSelected(row);
    form.reset({
      ...row,
      grading_bands: Array.isArray(row.grading_bands) ? JSON.stringify(row.grading_bands, null, 2) : row.grading_bands,
    });
    setDialog('edit');
  };

  const submit = (values: Record<string, unknown>) => {
    const input = Object.fromEntries(
      Object.entries(values).filter(([, value]) => value !== '' && !Number.isNaN(value))
    );
    if (resource === 'grading-schemes' && typeof input.grading_bands === 'string') {
      try {
        input.grading_bands = JSON.parse(input.grading_bands);
      } catch {
        // Validation schema handles json errors
      }
    }
    mutation.mutate(input);
  };

  const errors = useMemo(() => form.formState.errors, [form.formState.errors]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Admin master data</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">{config.label}</h1>
          <p className="mt-1 text-slate-600">{config.subtitle}</p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800"
        >
          Create {config.label.endsWith('s') ? config.label.slice(0, -1) : config.label}
        </button>
      </div>

      <div className="flex gap-2">
        <label className="sr-only" htmlFor="master-search">
          Search {config.label}
        </label>
        <input
          id="master-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (setPage(1), setSearch(q))}
          placeholder="Search and press Enter"
          className="w-full max-w-md rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
        />
        <button
          onClick={() => {
            setPage(1);
            setSearch(q);
          }}
          className="rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Search
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        {query.isLoading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-10 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="p-8 text-center" role="alert">
            <p className="text-red-700">Could not load {config.label.toLowerCase()}.</p>
            <button onClick={() => query.refetch()} className="mt-3 text-teal-700 underline font-medium">
              Retry
            </button>
          </div>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-slate-500">No records found.</p>
        ) : (
          <table className="responsive-table w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                {config.columns.map((column) => (
                  <th scope="col" key={column} className="px-4 py-3">
                    {columnLabel(column)}
                  </th>
                ))}
                <th scope="col" className="px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, index) => (
                <tr key={rowId(row) || index} className="hover:bg-slate-50">
                  {config.columns.map((column) => (
                    <td data-label={columnLabel(column)} key={column} className="px-4 py-3 text-slate-800">
                      {getDisplayValue(column, row[column])}
                    </td>
                  ))}
                  <td data-label="Actions" className="px-4 py-3">
                    <button onClick={() => openEdit(row)} className="mr-3 font-semibold text-teal-700 hover:underline">
                      Edit
                    </button>
                    <button onClick={() => setConfirm(row)} className="font-semibold text-red-700 hover:underline">
                      Deactivate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">{query.data?.meta?.total || 0} records</span>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
            className="rounded-lg border bg-white px-3 py-1 font-medium hover:bg-slate-50 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="px-2 py-1 text-slate-600">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((value) => value + 1)}
            className="rounded-lg border bg-white px-3 py-1 font-medium hover:bg-slate-50 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {dialog && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="master-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onKeyDown={(e) => e.key === 'Escape' && setDialog(null)}
        >
          <form
            onSubmit={form.handleSubmit(submit)}
            className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 id="master-dialog-title" className="text-xl font-bold text-slate-900">
              {dialog === 'create' ? 'Create' : 'Edit'}{' '}
              {config.label.endsWith('s') ? config.label.slice(0, -1) : config.label}
            </h2>

            {config.fields.map((field) => {
              const error = errors[field.key];
              const options =
                field.type === 'number'
                  ? { valueAsNumber: true }
                  : { setValueAs: (value: string) => (value === '' ? undefined : value) };

              const isIdField =
                field.key.endsWith('_id') &&
                Boolean(dropdownOptions[field.key as keyof typeof dropdownOptions]);

              if (isIdField) {
                const optionsList = dropdownOptions[field.key as keyof typeof dropdownOptions] || [];
                return (
                  <label key={field.key} className="block text-sm font-semibold text-slate-700">
                    {field.label}
                    <select
                      {...form.register(field.key, options)}
                      aria-describedby={`${field.key}-error`}
                      className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                    >
                      <option value="">Select {field.label.toLowerCase()}</option>
                      {optionsList.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {error && (
                      <span id={`${field.key}-error`} className="mt-1 block text-xs text-red-700">
                        {String(error.message)}
                      </span>
                    )}
                  </label>
                );
              }

              return (
                <label key={field.key} className="block text-sm font-semibold text-slate-700">
                  {field.label}
                  {field.type === 'checkbox' ? (
                    <input
                      type="checkbox"
                      {...form.register(field.key)}
                      className="ml-3 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                  ) : field.type === 'textarea' ? (
                    <textarea
                      {...form.register(field.key, options)}
                      aria-describedby={`${field.key}-error`}
                      rows={6}
                      className="mt-1 w-full rounded-lg border px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  ) : (
                    <input
                      {...form.register(field.key, options)}
                      type={field.type || 'text'}
                      aria-describedby={`${field.key}-error`}
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                    />
                  )}
                  {error && (
                    <span id={`${field.key}-error`} className="mt-1 block text-xs text-red-700">
                      {String(error.message)}
                    </span>
                  )}
                </label>
              );
            })}

            {mutation.isError && (
              <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
                {(mutation.error as Error & { problem?: ApiProblem }).problem?.detail ||
                  (mutation.error as Error).message ||
                  'Could not save record.'}
              </p>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDialog(null)}
                className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                disabled={mutation.isPending}
                className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {mutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {confirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 id="confirm-title" className="text-xl font-bold text-slate-900">
              Deactivate record?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              This cannot be undone. Referenced records will be rejected by the system.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setConfirm(null)}
                className="rounded-lg border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deactivate.mutate(rowId(confirm))}
                disabled={deactivate.isPending}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50"
              >
                {deactivate.isPending ? 'Deactivating…' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

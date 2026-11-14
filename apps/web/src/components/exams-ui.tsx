'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, type ApiProblem } from '../lib/api';
import { formatDate, formatSubjectName } from '../lib/format';
import { StatusBadge } from './status-badge';
import { useToast } from './toast';

type ExamSubject = {
  subject_id: string;
  subject_name?: string;
  max_marks: number;
  pass_marks: number;
};

type Exam = {
  _id: string;
  name: string;
  term: string;
  status: 'DRAFT' | 'MARKS_OPEN' | 'LOCKED' | 'PUBLISHED';
  class_id: string;
  academic_year_id: string;
  grading_scheme_id: string;
  starts_on: string;
  exam_subjects: ExamSubject[];
};

type Option = { _id: string; name: string; code?: string };
type Section = { _id: string; name: string; class_id: string };
type Student = { id: string; fullName?: string; full_name?: string; admissionNo?: string; admission_no?: string };
type MarkRow = {
  studentId: string;
  student_name?: string;
  admission_no?: string;
  roll_no?: number;
  subject_id?: string;
  subject_name?: string;
  marks: { marks_obtained: number | null; is_absent: boolean } | null;
};
type ProblemError = Error & { problem?: ApiProblem };

function errorText(error: unknown, fallback: string) {
  const code = (error as ProblemError).problem?.code;
  if (code === 'INCOMPLETE_MARKS')
    return 'Cannot lock yet: every student in the whole class needs marks (or Absent) for every subject. See the Marks progress panel below.';
  if (code === 'INVALID_STATE_TRANSITION')
    return "This action is not available in the exam's current state.";
  if (code === 'EDIT_WINDOW_CLOSED')
    return 'The marks edit window is closed.';
  if ((error as ProblemError).problem?.status === 422)
    return 'Please correct the highlighted values and try again.';
  return (error as ProblemError).problem?.detail || (error as Error)?.message || fallback;
}

const EXAM_STEPS: Array<{ key: Exam['status']; label: string }> = [
  { key: 'DRAFT', label: 'Draft' },
  { key: 'MARKS_OPEN', label: 'Marks open' },
  { key: 'LOCKED', label: 'Locked' },
  { key: 'PUBLISHED', label: 'Published' },
];

const STEP_DESCRIPTIONS: Record<Exam['status'], string> = {
  DRAFT: 'Draft: edit exam details and subjects. When ready for teachers to enter marks, open marks.',
  MARKS_OPEN: 'Marks open: teachers enter marks for their sections. When every student has marks, lock the exam.',
  LOCKED: 'Locked: results are final; publish to show report cards to guardians.',
  PUBLISHED: 'Published: exam results and report cards are visible to guardians.',
};

function percent(value: number) {
  return `${(value / 100).toFixed(2)}%`;
}

export function ExamList({ role }: { role: 'ADMIN' | 'TEACHER' }) {
  const [classId, setClassId] = useState('');
  const [yearId, setYearId] = useState('');
  const [status, setStatus] = useState('');

  const classes = useQuery({
    queryKey: ['exam-options', 'classes'],
    queryFn: () => apiRequest<{ data: Option[] }>('/classes?pageSize=100'),
  });
  const years = useQuery({
    queryKey: ['exam-options', 'years'],
    queryFn: () => apiRequest<{ data: Option[] }>('/academic-years?pageSize=100'),
  });
  const exams = useQuery({
    queryKey: ['exams', role, classId, yearId, status],
    queryFn: () =>
      apiRequest<{ data: Exam[]; meta: { total: number } }>(
        `/exams?pageSize=100${classId ? `&classId=${classId}` : ''}${yearId ? `&academicYearId=${yearId}` : ''}${
          status ? `&status=${status}` : ''
        }`
      ),
  });

  const classMap = new Map((classes.data?.data || []).map((c) => [c._id, c.name]));

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Exams</p>
          <h1 className="mt-1 text-3xl font-bold">{role === 'ADMIN' ? 'Exam management' : 'My exams'}</h1>
          <p className="mt-1 text-slate-600">Review exam state, marks entry, results, and report cards.</p>
          {role === 'TEACHER' && (
            <p className="mt-1 text-xs text-slate-500">
              Exams are created and published by administrators. You enter marks for the sections and subjects you teach.
            </p>
          )}
        </div>
        {role === 'ADMIN' && (
          <Link
            href="/admin/exams/new"
            className="rounded-lg bg-teal-700 px-4 py-2 text-center font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            Create exam
          </Link>
        )}
      </div>

      <div className="grid gap-3 rounded-2xl border bg-white p-5 shadow-sm sm:grid-cols-3">
        <label className="text-sm font-semibold text-slate-700">
          Class
          <select
            aria-label="Filter by class"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            <option value="">All classes</option>
            {(classes.data?.data || []).map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Academic year
          <select
            aria-label="Filter by academic year"
            value={yearId}
            onChange={(e) => setYearId(e.target.value)}
            className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            <option value="">All years</option>
            {(years.data?.data || []).map((item) => (
              <option key={item._id} value={item._id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Status
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            <option value="">All statuses</option>
            {['DRAFT', 'MARKS_OPEN', 'LOCKED', 'PUBLISHED'].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
        {exams.isLoading ? (
          <div className="space-y-3 p-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : exams.isError ? (
          <div className="p-6 text-red-700" role="alert">
            <p>{errorText(exams.error, 'Could not load exams.')}</p>
            <button
              onClick={() => exams.refetch()}
              className="mt-2 rounded-lg bg-red-100 px-3 py-1 font-semibold text-red-800 hover:bg-red-200"
            >
              Retry
            </button>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3">Name</th>
                <th scope="col" className="px-4 py-3">Term</th>
                <th scope="col" className="px-4 py-3">Class</th>
                <th scope="col" className="px-4 py-3">Start date</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(exams.data?.data || []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    {role === 'TEACHER' ? 'No exams assigned yet' : 'No exams found.'}
                  </td>
                </tr>
              ) : (
                (exams.data?.data || []).map((exam) => (
                  <tr key={exam._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      <Link
                        href={`${role === 'ADMIN' ? '/admin/exams' : '/teacher/exams'}/${exam._id}`}
                        className="text-teal-700 hover:underline"
                      >
                        {exam.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{exam.term}</td>
                    <td className="px-4 py-3 text-slate-600">{classMap.get(exam.class_id) || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(exam.starts_on)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge value={exam.status} />
                    </td>
                    <td className="px-4 py-3">
                      {role === 'TEACHER' && exam.status === 'MARKS_OPEN' ? (
                        <Link
                          href={`/teacher/exams/${exam._id}`}
                          className="rounded-lg bg-teal-700 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-800"
                        >
                          Enter marks
                        </Link>
                      ) : (
                        <Link
                          href={`${role === 'ADMIN' ? '/admin/exams' : '/teacher/exams'}/${exam._id}`}
                          className="text-xs font-semibold text-teal-700 underline"
                        >
                          View
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function useOptions() {
  const classes = useQuery({
    queryKey: ['exam-options', 'classes'],
    queryFn: () => apiRequest<{ data: Option[] }>('/classes?pageSize=100'),
  });
  const years = useQuery({
    queryKey: ['exam-options', 'years'],
    queryFn: () => apiRequest<{ data: Option[] }>('/academic-years?pageSize=100'),
  });
  const schemes = useQuery({
    queryKey: ['exam-options', 'schemes'],
    queryFn: () => apiRequest<{ data: Option[] }>('/grading-schemes?pageSize=100'),
  });
  const subjects = useQuery({
    queryKey: ['exam-options', 'subjects'],
    queryFn: () => apiRequest<{ data: Option[] }>('/subjects?pageSize=100'),
  });
  return { classes, years, schemes, subjects };
}

export function ExamEditor({ exam, examId }: { exam?: Exam; examId?: string }) {
  const router = useRouter();
  const options = useOptions();
  const notify = useToast();
  const loaded = useQuery({
    queryKey: ['exam-editor', examId],
    enabled: Boolean(examId && !exam),
    queryFn: () => apiRequest<{ data: Exam }>(`/exams/${examId}`),
  });
  const current = exam || loaded.data?.data;
  const [form, setForm] = useState({
    name: current?.name || '',
    term: current?.term || '',
    academicYearId: current?.academic_year_id || '',
    classId: current?.class_id || '',
    gradingSchemeId: current?.grading_scheme_id || '',
    startsOn: current?.starts_on?.slice(0, 10) || '',
    examSubjects: current?.exam_subjects.map((item) => ({
      subjectId: item.subject_id,
      maxMarks: String(item.max_marks / 100),
      passMarks: String(item.pass_marks / 100),
    })) || [{ subjectId: '', maxMarks: '100', passMarks: '40' }],
  });

  useEffect(() => {
    if (loaded.data?.data) {
      const item = loaded.data.data;
      setForm({
        name: item.name,
        term: item.term,
        academicYearId: item.academic_year_id,
        classId: item.class_id,
        gradingSchemeId: item.grading_scheme_id,
        startsOn: item.starts_on.slice(0, 10),
        examSubjects: item.exam_subjects.map((subject) => ({
          subjectId: subject.subject_id,
          maxMarks: String(subject.max_marks / 100),
          passMarks: String(subject.pass_marks / 100),
        })),
      });
    }
  }, [loaded.data]);

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest(`/exams${current ? `/${current._id}` : ''}`, {
        method: current ? 'PATCH' : 'POST',
        body: JSON.stringify(form),
      }),
    onSuccess: (result) => {
      notify(current ? 'Exam updated' : 'Exam created');
      router.push(`/admin/exams/${(result as { data: Exam }).data._id}`);
    },
    onError: (error) => notify(errorText(error, 'Could not save exam.'), 'error'),
  });

  const setSubject = (index: number, key: string, value: string) =>
    setForm((curr) => ({
      ...curr,
      examSubjects: curr.examSubjects.map((item, row) => (row === index ? { ...item, [key]: value } : item)),
    }));

  if (examId && loaded.isLoading) return <div className="h-48 animate-pulse rounded-2xl bg-slate-200" />;

  return (
    <section className="space-y-6">
      <Link href="/admin/exams" className="text-sm font-semibold text-teal-700 underline">
        ← Back to exams
      </Link>
      <h1 className="text-3xl font-bold">{current ? 'Edit draft exam' : 'Create exam'}</h1>
      <form
        className="space-y-6 rounded-2xl border bg-white p-6 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700">
            Name
            <input
              required
              aria-describedby="exam-name-error"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Term
            <input
              required
              value={form.term}
              onChange={(e) => setForm({ ...form, term: e.target.value })}
              className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Class
            <select
              required
              value={form.classId}
              onChange={(e) => setForm({ ...form, classId: e.target.value })}
              className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              <option value="">Select class</option>
              {(options.classes.data?.data || []).map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Academic year
            <select
              required
              value={form.academicYearId}
              onChange={(e) => setForm({ ...form, academicYearId: e.target.value })}
              className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              <option value="">Select year</option>
              {(options.years.data?.data || []).map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Grading scheme
            <select
              required
              value={form.gradingSchemeId}
              onChange={(e) => setForm({ ...form, gradingSchemeId: e.target.value })}
              className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            >
              <option value="">Select scheme</option>
              {(options.schemes.data?.data || []).map((item) => (
                <option key={item._id} value={item._id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Starts on
            <input
              required
              type="date"
              value={form.startsOn}
              onChange={(e) => setForm({ ...form, startsOn: e.target.value })}
              className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
          </label>
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900">Subjects</h2>
          <div className="mt-3 space-y-3">
            {form.examSubjects.map((item, index) => (
              <div key={index} className="grid gap-3 rounded-xl border bg-slate-50 p-4 sm:grid-cols-[1fr_150px_150px_auto]">
                <label className="text-sm font-semibold text-slate-700">
                  Subject
                  <select
                    required
                    value={item.subjectId}
                    onChange={(e) => setSubject(index, 'subjectId', e.target.value)}
                    className="mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    <option value="">Select subject</option>
                    {(options.subjects.data?.data || []).map((subject) => (
                      <option key={subject._id} value={subject._id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Max marks
                  <input
                    required
                    inputMode="decimal"
                    value={item.maxMarks}
                    onChange={(e) => setSubject(index, 'maxMarks', e.target.value)}
                    className="mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Pass marks
                  <input
                    required
                    inputMode="decimal"
                    value={item.passMarks}
                    onChange={(e) => setSubject(index, 'passMarks', e.target.value)}
                    className="mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </label>
                {form.examSubjects.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        examSubjects: form.examSubjects.filter((_, row) => row !== index),
                      })
                    }
                    className="self-end rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              setForm({
                ...form,
                examSubjects: [...form.examSubjects, { subjectId: '', maxMarks: '100', passMarks: '40' }],
              })
            }
            className="mt-3 rounded-lg border bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            + Add subject
          </button>
        </div>

        {mutation.isError && (
          <p id="exam-name-error" role="alert" className="text-sm text-red-700">
            {errorText(mutation.error, 'Could not save exam.')}
          </p>
        )}

        <button
          disabled={mutation.isPending}
          className="rounded-lg bg-teal-700 px-5 py-2 font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving…' : 'Save exam'}
        </button>
      </form>
    </section>
  );
}

export function ExamDetail({ admin = false }: { admin?: boolean }) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const client = useQueryClient();
  const notify = useToast();
  const [reason, setReason] = useState('');

  const exam = useQuery({
    queryKey: ['exam', params.id],
    queryFn: () => apiRequest<{ data: Exam }>(`/exams/${params.id}`),
    retry: false,
  });

  const sections = useQuery({
    queryKey: ['exam-sections', exam.data?.data.class_id],
    enabled: Boolean(exam.data?.data.class_id),
    queryFn: () => apiRequest<{ data: Section[] }>('/attendance/sections'),
  });

  const availableSections = (sections.data?.data || []).filter(
    (item) => item.class_id === exam.data?.data.class_id
  );
  const [sectionId, setSectionId] = useState('');

  useEffect(() => {
    if (!sectionId && availableSections[0]?._id) {
      setSectionId(availableSections[0]._id);
    }
  }, [availableSections, sectionId]);

  const results = useQuery({
    queryKey: ['exam-results', params.id, sectionId],
    enabled: Boolean(sectionId),
    queryFn: () =>
      apiRequest<{
        data: Array<{
          studentId: string;
          student_name?: string;
          admission_no?: string;
          roll_no?: number;
          total: number;
          overallPercent: number;
          grade: string | null;
          result: string;
          rank: number | null;
        }>;
      }>(`/exams/${params.id}/results?sectionId=${sectionId}`),
  });

  const performance = useQuery({
    queryKey: ['exam-performance', params.id, sectionId],
    enabled: Boolean(sectionId),
    queryFn: () =>
      apiRequest<{
        data: {
          averages: number;
          passRate: number;
          gradeDistribution: Record<string, number>;
        };
      }>(`/reports/academic/section-performance?examId=${params.id}&sectionId=${sectionId}`),
  });

  type MarksProgressRow = {
    section_id: string;
    section_name: string;
    subject_id: string;
    subject_name: string;
    enrolled_count: number;
    entered_count: number;
    missing_students: string[];
    teacher_name: string | null;
  };

  const marksProgress = useQuery({
    queryKey: ['exam-marks-progress', params.id],
    enabled: Boolean(admin && params.id),
    queryFn: () =>
      apiRequest<{
        data: MarksProgressRow[];
        meta: {
          ready_to_lock: boolean;
          missing_students_count: number;
          total_missing_marks: number;
        };
      }>(`/exams/${params.id}/marks-progress`),
  });

  const action = useMutation({
    mutationFn: (name: string) =>
      apiRequest(`/exams/${params.id}/${name}`, {
        method: 'POST',
        body: JSON.stringify(name === 'reopen' ? { reason } : {}),
      }),
    onSuccess: () => {
      notify('Exam state updated');
      client.invalidateQueries({ queryKey: ['exam', params.id] });
      client.invalidateQueries({ queryKey: ['exam-marks-progress', params.id] });
    },
    onError: (error) => notify(errorText(error, 'Could not change exam state.'), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest(`/exams/${params.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      notify('Exam deleted');
      router.push('/admin/exams');
    },
    onError: (error) => notify(errorText(error, 'Could not delete exam.'), 'error'),
  });

  if (exam.isLoading) return <div className="h-48 animate-pulse rounded-2xl bg-slate-200" />;
  if (exam.isError || !exam.data) {
    if (typeof window !== 'undefined') router.replace('/404');
    return null;
  }

  const value = exam.data.data;
  const isReadyToLock = marksProgress.data?.meta?.ready_to_lock ?? false;
  const missingCount = marksProgress.data?.meta?.missing_students_count ?? 0;

  return (
    <section className="space-y-6">
      <Link
        href={admin ? '/admin/exams' : '/teacher/exams'}
        className="text-sm font-semibold text-teal-700 underline"
      >
        ← Back to exams
      </Link>

      {admin ? (
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
            {EXAM_STEPS.map((step, idx) => {
              const stepIndex = EXAM_STEPS.findIndex((s) => s.key === value.status);
              const isCurrent = step.key === value.status;
              const isPast = idx < stepIndex;
              return (
                <div key={step.key} className="flex min-w-[120px] flex-1 items-center gap-2">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      isCurrent
                        ? 'bg-teal-700 text-white ring-4 ring-teal-100'
                        : isPast
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isPast ? '✓' : idx + 1}
                  </div>
                  <span
                    className={`text-sm ${
                      isCurrent ? 'font-bold text-teal-900' : isPast ? 'font-semibold text-slate-800' : 'text-slate-400'
                    }`}
                  >
                    {step.label}
                  </span>
                  {idx < EXAM_STEPS.length - 1 && (
                    <div className={`h-0.5 flex-1 ${isPast ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-3 border-t pt-3 text-sm text-slate-600">
            {STEP_DESCRIPTIONS[value.status]}
          </p>
        </div>
      ) : (
        <p className="text-sm text-slate-600">
          Exams are created and published by administrators. You enter marks for the sections and subjects you teach.
        </p>
      )}

      {(action.isError || deleteMutation.isError) && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Action could not be completed</p>
          <p className="mt-0.5">{errorText(action.error || deleteMutation.error, 'Request failed.')}</p>
        </div>
      )}

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{value.name}</h1>
          <p className="mt-1 text-slate-600">
            {value.term} · Starts {formatDate(value.starts_on)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge value={value.status} />
          {admin && (
            <div className="flex flex-wrap items-center gap-2">
              {value.status === 'DRAFT' && (
                <>
                  <button
                    onClick={() => action.mutate('open')}
                    disabled={action.isPending}
                    className="rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                  >
                    Open marks
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Delete this draft exam? This action cannot be undone.')) {
                        deleteMutation.mutate();
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deleteMutation.isPending ? 'Deleting…' : 'Delete exam'}
                  </button>
                </>
              )}
              {value.status === 'MARKS_OPEN' && (
                <div className="flex flex-col items-end gap-1">
                  {marksProgress.isLoading ? (
                    <span className="text-xs text-slate-500">Checking progress…</span>
                  ) : isReadyToLock ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Ready to lock
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      Not ready: {missingCount} {missingCount === 1 ? 'student' : 'students'} still missing marks
                    </span>
                  )}
                  <button
                    onClick={() => action.mutate('lock')}
                    disabled={action.isPending || !isReadyToLock}
                    title={!isReadyToLock ? `Cannot lock: ${missingCount} students still missing marks. Complete all marks first.` : undefined}
                    className="rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Lock
                  </button>
                </div>
              )}
              {value.status === 'LOCKED' && (
                <>
                  <button
                    onClick={() => action.mutate('publish')}
                    disabled={action.isPending}
                    className="rounded-lg bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                  >
                    Publish
                  </button>
                  <button
                    onClick={() => {
                      const next = window.prompt('Reason for reopening');
                      if (next) {
                        setReason(next);
                        action.mutate('reopen');
                      }
                    }}
                    disabled={action.isPending}
                    className="rounded-lg border bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
                  >
                    Reopen
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-sm">
        <label className="block text-sm font-semibold text-slate-700">
          Section
          <select
            aria-label="Exam section"
            value={sectionId}
            onChange={(event) => setSectionId(event.target.value)}
            className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            {availableSections.map((section) => (
              <option key={section._id} value={section._id}>
                {section.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {value.status === 'MARKS_OPEN' && !admin && <MarksEntry exam={value} sectionId={sectionId} />}

      {admin && value.status === 'DRAFT' && (
        <Link
          href={`/admin/exams/${value._id}/edit`}
          className="inline-block rounded-lg border bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
        >
          Edit draft
        </Link>
      )}

      {admin && (
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">Marks progress</h2>
            <p className="mt-1 text-sm text-slate-600">
              Track marks entry across all sections, subjects, and teacher assignments.
            </p>
          </div>
          {marksProgress.isLoading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />
              ))}
            </div>
          ) : marksProgress.isError ? (
            <div className="p-6 text-red-700" role="alert">
              <p className="font-medium">{errorText(marksProgress.error, 'Could not load marks progress.')}</p>
              <button
                type="button"
                onClick={() => marksProgress.refetch()}
                className="mt-2 rounded-lg bg-red-100 px-3 py-1 font-semibold text-red-800 hover:bg-red-200"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                  <tr>
                    <th scope="col" className="px-4 py-3">Section</th>
                    <th scope="col" className="px-4 py-3">Subject</th>
                    <th scope="col" className="px-4 py-3">Entered / Total</th>
                    <th scope="col" className="px-4 py-3">Teacher</th>
                    <th scope="col" className="px-4 py-3">Missing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(marksProgress.data?.data || []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                        No sections or subjects found for this exam.
                      </td>
                    </tr>
                  ) : (
                    marksProgress.data?.data.map((row) => {
                      const isUnderfilled = row.entered_count < row.enrolled_count;
                      const noTeacher = !row.teacher_name;
                      const rowBg = noTeacher
                        ? 'bg-red-50/70 hover:bg-red-50'
                        : isUnderfilled
                        ? 'bg-amber-50/60 hover:bg-amber-50'
                        : 'hover:bg-slate-50';

                      return (
                        <tr key={`${row.section_id}-${row.subject_id}`} className={rowBg}>
                          <td className="px-4 py-3 font-semibold text-slate-900">{row.section_name}</td>
                          <td className="px-4 py-3 text-slate-700">{row.subject_name}</td>
                          <td className="px-4 py-3">
                            <span className={`font-medium ${isUnderfilled ? 'font-semibold text-amber-800' : 'text-emerald-700'}`}>
                              {row.entered_count} / {row.enrolled_count}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {row.teacher_name ? (
                              <span className="text-slate-800">{row.teacher_name}</span>
                            ) : (
                              <span className="font-semibold text-red-700">
                                No teacher assigned: assign one under Teacher assignments
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {row.missing_students.length > 0 ? (
                              <span>
                                {row.missing_students.join(', ')}
                                {row.enrolled_count - row.entered_count > row.missing_students.length && (
                                  <span className="text-slate-400">
                                    {' '}+{row.enrolled_count - row.entered_count - row.missing_students.length} more
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="font-medium text-emerald-700">None (all entered)</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Section performance */}
        <div className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-900">Section performance</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Average</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {performance.data?.data.averages ? percent(performance.data.data.averages) : '—'}
              </p>
            </div>
            <div className="rounded-xl border bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">Pass rate</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {performance.data?.data.passRate ? percent(performance.data.data.passRate) : '—'}
              </p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-2">Grade</th>
                  <th scope="col" className="px-4 py-2">Students</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(performance.data?.data.gradeDistribution || {}).length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-center text-slate-500">
                      No grades recorded
                    </td>
                  </tr>
                ) : (
                  Object.entries(performance.data?.data.gradeDistribution || {}).map(([grade, count]) => (
                    <tr key={grade} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-semibold">{grade}</td>
                      <td className="px-4 py-2">{count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Results panel */}
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="font-bold text-slate-900">Results</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3">Roll no / Student</th>
                  <th scope="col" className="px-4 py-3">Total marks</th>
                  <th scope="col" className="px-4 py-3">Percent</th>
                  <th scope="col" className="px-4 py-3">Grade</th>
                  <th scope="col" className="px-4 py-3">Result</th>
                  <th scope="col" className="px-4 py-3">Rank</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(results.data?.data || []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                      No results published yet
                    </td>
                  </tr>
                ) : (
                  (results.data?.data || []).map((row) => (
                    <tr key={String(row.studentId)} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {row.roll_no ? `${row.roll_no} · ` : ''}
                        {row.student_name || row.studentId}
                        {row.admission_no ? ` (${row.admission_no})` : ''}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.total / 100}</td>
                      <td className="px-4 py-3 text-slate-700">{percent(row.overallPercent)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge value={row.grade || '—'} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge value={row.result} />
                      </td>
                      <td className="px-4 py-3 text-slate-700">Rank {row.rank ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

export function MarksEntry({ exam: _exam, sectionId }: { exam?: Exam; sectionId: string }) {
  const params = useParams<{ id: string }>();
  const client = useQueryClient();
  const notify = useToast();

  const mySubjectsQuery = useQuery({
    queryKey: ['my-subjects', params.id, sectionId],
    enabled: Boolean(sectionId),
    queryFn: () =>
      apiRequest<{ data: ExamSubject[] }>(`/exams/${params.id}/my-subjects?sectionId=${sectionId}`),
  });

  const allowedSubjects = mySubjectsQuery.data?.data || [];
  const [subjectId, setSubjectId] = useState('');

  useEffect(() => {
    if (allowedSubjects.length > 0) {
      if (!allowedSubjects.some((s) => s.subject_id === subjectId)) {
        setSubjectId(allowedSubjects[0].subject_id);
      }
    } else {
      setSubjectId('');
    }
  }, [allowedSubjects, subjectId]);

  const rows = useQuery({
    queryKey: ['marks', params.id, subjectId, sectionId],
    enabled: Boolean(sectionId && subjectId),
    queryFn: () =>
      apiRequest<{ data: MarkRow[] }>(
        `/exams/${params.id}/subjects/${subjectId}/marks?sectionId=${sectionId}`
      ),
  });

  const [values, setValues] = useState<Record<string, { marks: string; absent: boolean }>>({});
  const [savedValues, setSavedValues] = useState<Record<string, { marks: string; absent: boolean }>>({});

  useEffect(() => {
    const next: Record<string, { marks: string; absent: boolean }> = {};
    (rows.data?.data || []).forEach((row) => {
      next[row.studentId] = {
        marks:
          row.marks?.marks_obtained === null || row.marks?.marks_obtained === undefined
            ? ''
            : String(row.marks.marks_obtained / 100),
        absent: row.marks?.is_absent || false,
      };
    });
    setValues(next);
    setSavedValues(next);
  }, [rows.data]);

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest(`/exams/${params.id}/subjects/${subjectId}/marks?sectionId=${sectionId}`, {
        method: 'PUT',
        body: JSON.stringify({
          records: Object.entries(values).map(([studentId, value]) => ({
            studentId,
            marks: value.absent ? null : value.marks,
            isAbsent: value.absent,
          })),
        }),
      }),
    onSuccess: () => {
      setSavedValues(values);
      notify('Marks saved');
      client.invalidateQueries({ queryKey: ['marks', params.id, subjectId, sectionId] });
      client.invalidateQueries({ queryKey: ['exam-marks-progress', params.id] });
    },
    onError: (error) => notify(errorText(error, 'Could not save marks.'), 'error'),
  });

  const dirty = JSON.stringify(values) !== JSON.stringify(savedValues);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  if (mySubjectsQuery.isLoading) {
    return <div className="h-40 animate-pulse rounded-2xl bg-slate-100" />;
  }

  if (allowedSubjects.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        <p className="font-semibold">No assigned subjects</p>
        <p className="mt-1">You are not assigned to any subject in this exam for this section.</p>
      </div>
    );
  }

  const currentSubject = allowedSubjects.find((subject) => subject.subject_id === subjectId) || allowedSubjects[0];
  const maxMarks = (currentSubject?.max_marks || 0) / 100;
  const rowData = rows.data?.data || [];

  return (
    <div className="space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Marks entry</h2>
        <p className="mt-1 text-sm text-slate-600">
          Enter marks as decimals with up to two decimal places (maximum {maxMarks}).
        </p>
      </div>

      <div className="max-w-sm">
        <label className="block text-sm font-semibold text-slate-700">
          Subject
          <select
            aria-label="Marks subject"
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value)}
            className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            {allowedSubjects.map((subject) => (
              <option key={subject.subject_id} value={subject.subject_id}>
                {formatSubjectName(subject, subject.subject_id)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        {rows.isLoading ? (
          <div className="space-y-2 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />
            ))}
          </div>
        ) : rows.isError ? (
          <div className="p-6 text-red-700" role="alert">
            <p className="font-medium">{errorText(rows.error, 'Could not load marks.')}</p>
            <button
              type="button"
              onClick={() => rows.refetch()}
              className="mt-2 rounded-lg bg-red-100 px-3 py-1 font-semibold text-red-800 hover:bg-red-200"
            >
              Retry
            </button>
          </div>
        ) : rowData.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No students enrolled in this section.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3">Roll no</th>
                <th scope="col" className="px-4 py-3">Student</th>
                <th scope="col" className="px-4 py-3">Marks (out of {maxMarks})</th>
                <th scope="col" className="px-4 py-3">Absent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rowData.map((row) => (
                <tr key={row.studentId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-700">{row.roll_no ?? '—'}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{row.student_name || row.studentId}</p>
                    {row.admission_no && <p className="text-xs text-slate-500">{row.admission_no}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      aria-label={`Marks for ${row.student_name || row.studentId}`}
                      type="number"
                      min="0"
                      max={maxMarks}
                      step="0.01"
                      disabled={values[row.studentId]?.absent}
                      inputMode="decimal"
                      value={values[row.studentId]?.marks || ''}
                      onChange={(e) =>
                        setValues({
                          ...values,
                          [row.studentId]: { ...values[row.studentId], marks: e.target.value },
                        })
                      }
                      className="w-32 rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-600 disabled:bg-slate-100"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <label className="inline-flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={values[row.studentId]?.absent || false}
                        onChange={(e) =>
                          setValues({
                            ...values,
                            [row.studentId]: {
                              ...values[row.studentId],
                              absent: e.target.checked,
                              marks: e.target.checked ? '' : values[row.studentId]?.marks || '',
                            },
                          })
                        }
                        className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      Absent
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          disabled={mutation.isPending || !sectionId || rowData.length === 0}
          onClick={() => mutation.mutate()}
          className="rounded-lg bg-teal-700 px-5 py-2 font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving…' : 'Save marks'}
        </button>
        <span className="text-sm" aria-live="polite">
          {mutation.isSuccess ? (
            <span className="text-emerald-700">Marks saved successfully.</span>
          ) : mutation.isError ? (
            <span className="text-red-700">{errorText(mutation.error, 'Could not save marks.')}</span>
          ) : (
            dirty && <span className="text-amber-700">Unsaved changes</span>
          )}
        </span>
      </div>
    </div>
  );
}

export function ReportCard({ studentId, examId }: { studentId: string; examId: string }) {
  const router = useRouter();
  const report = useQuery({
    queryKey: ['report-card', studentId, examId],
    queryFn: () =>
      apiRequest<{
        data: {
          student: { full_name: string; admission_no: string };
          exam: Exam;
          subjects: Array<{
            subjectId: string;
            subject_name?: string;
            marks: number;
            maxMarks: number;
            percent: number;
            grade: string | null;
            pass: boolean;
            absent: boolean;
          }>;
          total: number;
          maxTotal: number;
          overallPercent: number;
          grade: string | null;
          result: string;
          rank: number | null;
          sectionStrength: number;
        };
      }>(`/students/${studentId}/exams/${examId}/report-card`),
    retry: false,
  });

  useEffect(() => {
    if (report.isError) router.replace('/404');
  }, [report.isError, router]);

  if (report.isError) return null;
  if (report.isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />;

  const value = report.data!.data;

  return (
    <section className="space-y-6 print:text-black">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Report card</p>
          <h1 className="mt-1 text-3xl font-bold">{value.student.full_name}</h1>
          <p className="mt-1 text-slate-600">
            {value.student.admission_no} · {value.exam.name}
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-600 print:hidden"
        >
          Print / Save as PDF
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Total</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {value.total / 100} / {value.maxTotal / 100}
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Percent</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{percent(value.overallPercent)}</p>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Grade</p>
          <div className="mt-1">
            <StatusBadge value={value.grade || '—'} />
          </div>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="text-xs uppercase text-slate-500">Result</p>
          <div className="mt-1">
            <StatusBadge value={value.result} />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th scope="col" className="px-4 py-3">Subject</th>
              <th scope="col" className="px-4 py-3">Marks / max</th>
              <th scope="col" className="px-4 py-3">Percent</th>
              <th scope="col" className="px-4 py-3">Grade</th>
              <th scope="col" className="px-4 py-3">Result</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {value.subjects.map((subject) => (
              <tr key={subject.subjectId} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-900">
                  {formatSubjectName(subject, subject.subjectId)}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {subject.absent ? 'ABSENT' : `${subject.marks / 100} / ${subject.maxMarks / 100}`}
                </td>
                <td className="px-4 py-3 text-slate-700">{percent(subject.percent)}</td>
                <td className="px-4 py-3">
                  <StatusBadge value={subject.grade || '—'} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge value={subject.absent ? 'ABSENT' : subject.pass ? 'PASS' : 'FAIL'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-slate-600">
        Rank {value.rank ?? '—'} of {value.sectionStrength} students
      </p>
    </section>
  );
}

export function GuardianExamReports() {
  const exams = useQuery({
    queryKey: ['guardian-exams'],
    queryFn: () => apiRequest<{ data: Exam[] }>('/exams?pageSize=100'),
  });
  const students = useQuery({
    queryKey: ['guardian-students'],
    queryFn: () => apiRequest<{ data: Student[] }>('/students?pageSize=100'),
  });

  if (exams.isLoading || students.isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    );
  }

  const reports = (students.data?.data || []).flatMap((student) =>
    (exams.data?.data || []).map((exam) => ({ student, exam }))
  );

  if (reports.length === 0) {
    return <p className="text-sm text-slate-500">No published report cards yet.</p>;
  }

  return (
    <div className="space-y-4">
      {reports.map(({ student, exam }) => (
        <Link
          key={`${student.id}-${exam._id}`}
          href={`/guardian/report-cards/${student.id}/${exam._id}`}
          className="block rounded-2xl border bg-white p-5 shadow-sm transition hover:border-teal-500 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-teal-600"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900">{student.fullName || student.full_name || 'Student'}</h3>
            <span className="text-xs font-semibold text-teal-700">View report card →</span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {exam.name} · {exam.term}
          </p>
        </Link>
      ))}
    </div>
  );
}

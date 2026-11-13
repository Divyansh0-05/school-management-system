import React from 'react';

const greenStatuses = new Set(['PASS', 'PUBLISHED', 'PAID', 'SUCCEEDED', 'ACTIVE', 'PRESENT']);
const redStatuses = new Set(['FAIL', 'VOID', 'FAILED', 'INACTIVE', 'ABSENT']);
const blueStatuses = new Set(['LOCKED', 'MARKS_OPEN', 'LATE']);
const amberStatuses = new Set(['DRAFT', 'PENDING', 'ISSUED', 'PARTIALLY_PAID', 'INCOMPLETE', 'EXCUSED']);

export function StatusBadge({ value, className = '' }: { value?: string | null; className?: string }) {
  if (!value) return <span>—</span>;
  const upper = String(value).toUpperCase();

  let colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';
  if (greenStatuses.has(upper)) {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  } else if (redStatuses.has(upper)) {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-200';
  } else if (blueStatuses.has(upper)) {
    colorClasses = 'bg-sky-50 text-sky-700 border-sky-200';
  } else if (amberStatuses.has(upper)) {
    colorClasses = 'bg-amber-50 text-amber-800 border-amber-200';
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colorClasses} ${className}`}
    >
      {value}
    </span>
  );
}

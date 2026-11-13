export function formatMoney(paise: number): string {
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateInput: string | number | Date | null | undefined): string {
  if (!dateInput) return '—';
  try {
    const d = new Date(dateInput);
    if (Number.isNaN(d.getTime())) return '—';
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleString('en-GB', { month: 'short' });
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  } catch {
    return '—';
  }
}

export function formatSubjectName(sub?: { subject_name?: string; name?: string; subjectId?: string; subject_id?: string } | null, fallbackId?: string): string {
  if (!sub && !fallbackId) return 'Subject';
  if (sub?.subject_name) return sub.subject_name;
  if (sub?.name) return sub.name;
  const id = sub?.subjectId || sub?.subject_id || fallbackId || '';
  if (id.length >= 4) return `Subject ${id.slice(-4)}`;
  return id ? `Subject ${id}` : 'Subject';
}

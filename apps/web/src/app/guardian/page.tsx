import { requireUser } from '../../lib/auth';
import { GuardianChildren } from '../../components/attendance-ui';
import { GuardianExamReports } from '../../components/exams-ui';
import { GuardianInvoices } from '../../components/fees-ui';

export default async function GuardianPage() {
  const user = await requireUser();
  if (user.role !== 'GUARDIAN') return null;
  return <main><p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Guardian portal</p><h1 className="mt-1 text-3xl font-bold">My children</h1><p className="mt-2 text-slate-600">Attendance, published report cards, and fee invoices for linked children.</p><div className="mt-8"><GuardianChildren /></div><h2 className="mt-10 text-2xl font-bold">Published report cards</h2><div className="mt-4"><GuardianExamReports /></div><GuardianInvoices /></main>;
}

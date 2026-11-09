import { requireUser } from '../../lib/auth';
import { GuardianChildren } from '../../components/attendance-ui';

export default async function GuardianPage() {
  const user = await requireUser();
  if (user.role !== 'GUARDIAN') return null;
  return <main><p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Attendance</p><h1 className="mt-1 text-3xl font-bold">My children</h1><p className="mt-2 text-slate-600">Read-only attendance summaries for your linked children.</p><div className="mt-8"><GuardianChildren /></div></main>;
}

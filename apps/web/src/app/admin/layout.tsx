import { redirect } from 'next/navigation';
import { AdminShell } from '../../components/admin-shell';
import { requireUser } from '../../lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.role !== 'ADMIN') redirect('/403');
  return <AdminShell name={user.fullName}>{children}</AdminShell>;
}

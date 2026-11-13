import { redirect } from 'next/navigation';
import { UserShell } from '../../components/user-shell';
import { requireUser } from '../../lib/auth';

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.role !== 'TEACHER') redirect('/403');
  return (
    <UserShell
      user={{ fullName: user.fullName, role: user.role }}
      navLinks={[
        { href: '/teacher', label: 'Sections' },
        { href: '/teacher/exams', label: 'Exams' },
      ]}
    >
      {children}
    </UserShell>
  );
}

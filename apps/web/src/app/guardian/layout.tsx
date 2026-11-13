import { redirect } from 'next/navigation';
import { UserShell } from '../../components/user-shell';
import { requireUser } from '../../lib/auth';

export default async function GuardianLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.role !== 'GUARDIAN') redirect('/403');
  return (
    <UserShell
      user={{ fullName: user.fullName, role: user.role }}
      navLinks={[
        { href: '/guardian', label: 'Home' },
      ]}
    >
      {children}
    </UserShell>
  );
}

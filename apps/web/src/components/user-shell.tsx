'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { apiRequest } from '../lib/api';

export interface UserShellProps {
  children: React.ReactNode;
  user: {
    fullName: string;
    role: string;
  };
  navLinks: Array<{ href: string; label: string }>;
}

export function UserShell({ children, user, navLinks }: UserShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await apiRequest('/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-teal-700">School OS</p>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">{user.fullName}</span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{user.role}</span>
              </div>
            </div>
            <nav aria-label="Main navigation" className="flex items-center gap-2">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || (link.href !== '/teacher' && link.href !== '/guardian' && pathname.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-teal-700 text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/change-password" className="text-teal-700 underline">
              Change password
            </Link>
            <button onClick={logout} className="font-semibold text-red-700 hover:underline">
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4 sm:p-8">{children}</main>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';

const links = [
  ['students', 'Students'], ['guardians', 'Guardians'], ['teachers', 'Teachers'],
  ['classes', 'Classes'], ['sections', 'Sections'], ['subjects', 'Subjects'],
  ['academic-years', 'Academic years'], ['enrollments', 'Enrollments'],
  ['teacher-assignments', 'Teacher assignments'], ['class-subjects', 'Class subjects'],
  ['fee-heads', 'Fee heads'], ['grading-schemes', 'Grading schemes'],
  ['attendance', 'Attendance'], ['exams', 'Exams'], ['invoices', 'Invoices'], ['reports/fees', 'Fee reports'], ['audit-logs', 'Audit logs'],
];

export function AdminShell({ children, name }: { children: React.ReactNode; name: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  async function logout() {
    await apiRequest('/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
      <button
        type="button"
        className={`fixed left-4 top-4 z-40 rounded-lg border bg-white p-2 lg:hidden ${open ? 'hidden' : 'block'}`}
        onClick={() => setOpen(true)}
        aria-label="Toggle navigation"
        aria-expanded={open}
        aria-controls="admin-sidebar"
      >
        ☰
      </button>
      <aside
        id="admin-sidebar"
        className={`fixed inset-y-0 left-0 z-30 h-full w-72 overflow-y-auto border-r bg-slate-950 p-5 text-white transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-7 flex items-center justify-between px-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-300">School OS</p>
            <p className="mt-1 text-xl font-bold">Administration</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            ✕
          </button>
        </div>
        <nav className="space-y-1" aria-label="Admin navigation">
          {links.map(([href, label]) => (
            <Link
              key={href}
              onClick={() => setOpen(false)}
              href={`/admin/${href}`}
              className={`block rounded-lg px-3 py-2 text-sm ${
                pathname.includes(`/admin/${href}`)
                  ? 'bg-teal-700 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="lg:pl-72">
        <header className="flex items-center justify-between border-b bg-white px-6 py-4 pl-16 lg:pl-8">
          <div>
            <p className="text-sm text-slate-500">Admin workspace</p>
            <p className="font-semibold">{name}</p>
          </div>
          <div className="flex gap-4 text-sm">
            <Link href="/change-password" className="text-teal-700 underline">
              Change password
            </Link>
            <button onClick={logout} className="font-semibold text-red-700">
              Log out
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-6xl p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}

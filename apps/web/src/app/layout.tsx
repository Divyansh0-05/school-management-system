import type { Metadata } from 'next';
import './globals.css';
import { QueryProvider } from '../components/query-provider';

export const metadata: Metadata = {
  title: 'School Management System',
  description: 'Full-stack modular monolith for academic administration, attendance, exams, fees, and RBAC',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}

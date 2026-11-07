import type { Metadata } from 'next';
import './globals.css';

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
        <main className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}


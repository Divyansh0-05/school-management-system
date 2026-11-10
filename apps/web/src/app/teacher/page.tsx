import { requireUser } from '../../lib/auth';
import { TeacherSections } from '../../components/attendance-ui';
import Link from 'next/link';

export default async function TeacherPage() {
  const user = await requireUser();
  if (user.role !== 'TEACHER') return null;
  return <main><TeacherSections /><Link href="/teacher/exams" className="mt-6 inline-block rounded-lg border bg-white px-4 py-2 font-semibold text-teal-700">Open my exams</Link></main>;
}

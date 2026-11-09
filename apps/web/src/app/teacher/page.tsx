import { requireUser } from '../../lib/auth';
import { TeacherSections } from '../../components/attendance-ui';

export default async function TeacherPage() {
  const user = await requireUser();
  if (user.role !== 'TEACHER') return null;
  return <main><TeacherSections /></main>;
}

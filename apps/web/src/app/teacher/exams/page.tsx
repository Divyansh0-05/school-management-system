import { requireUser } from '../../../lib/auth';
import { ExamList } from '../../../components/exams-ui';

export default async function TeacherExamsPage() {
  const user = await requireUser();
  if (user.role !== 'TEACHER') return null;
  return <ExamList role="TEACHER" />;
}

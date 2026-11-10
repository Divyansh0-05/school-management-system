import { requireUser } from '../../../../lib/auth';
import { ExamDetail } from '../../../../components/exams-ui';

export default async function TeacherExamDetailPage() {
  const user = await requireUser();
  if (user.role !== 'TEACHER') return null;
  return <ExamDetail />;
}

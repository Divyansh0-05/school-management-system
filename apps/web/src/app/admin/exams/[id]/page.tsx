import { requireUser } from '../../../../lib/auth';
import { ExamDetail } from '../../../../components/exams-ui';

export default async function AdminExamDetailPage() {
  const user = await requireUser();
  if (user.role !== 'ADMIN') return null;
  return <ExamDetail admin />;
}

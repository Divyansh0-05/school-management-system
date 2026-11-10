import { requireUser } from '../../../lib/auth';
import { ExamList } from '../../../components/exams-ui';

export default async function AdminExamsPage() {
  const user = await requireUser();
  if (user.role !== 'ADMIN') return null;
  return <ExamList role="ADMIN" />;
}

import { requireUser } from '../../../../lib/auth';
import { ExamEditor } from '../../../../components/exams-ui';

export default async function NewExamPage() {
  const user = await requireUser();
  if (user.role !== 'ADMIN') return null;
  return <ExamEditor />;
}

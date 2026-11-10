import { requireUser } from '../../../../../lib/auth';
import { ReportCard } from '../../../../../components/exams-ui';

export default async function TeacherReportCardPage({ params }: { params: { studentId: string; examId: string } }) {
  const user = await requireUser();
  if (user.role !== 'TEACHER') return null;
  return <ReportCard studentId={params.studentId} examId={params.examId} />;
}

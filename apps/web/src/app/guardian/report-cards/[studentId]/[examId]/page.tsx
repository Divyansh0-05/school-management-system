import { requireUser } from '../../../../../lib/auth';
import { ReportCard } from '../../../../../components/exams-ui';

export default async function GuardianReportCardPage({ params }: { params: { studentId: string; examId: string } }) {
  const user = await requireUser();
  if (user.role !== 'GUARDIAN') return null;
  return <ReportCard studentId={params.studentId} examId={params.examId} />;
}

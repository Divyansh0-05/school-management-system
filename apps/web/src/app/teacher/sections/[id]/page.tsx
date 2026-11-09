import { redirect } from 'next/navigation';
import { AttendanceSheet } from '../../../../components/attendance-ui';
import { requireUser } from '../../../../lib/auth';

export default async function TeacherAttendancePage() {
  const user = await requireUser();
  if (user.role !== 'TEACHER') redirect('/403');
  return <AttendanceSheet />;
}

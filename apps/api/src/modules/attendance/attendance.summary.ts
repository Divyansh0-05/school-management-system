import type { AttendanceStatus } from '@school/shared';

export interface AttendanceCounts {
  present: number;
  absent: number;
  late: number;
  excused: number;
  marked: number;
  percentageHundredths: number;
  percentage: string;
}

export function calculateAttendanceSummary(statuses: AttendanceStatus[]): AttendanceCounts {
  const counts = {
    present: statuses.filter((status) => status === 'PRESENT').length,
    absent: statuses.filter((status) => status === 'ABSENT').length,
    late: statuses.filter((status) => status === 'LATE').length,
    excused: statuses.filter((status) => status === 'EXCUSED').length,
  };
  const marked = statuses.length;
  const percentageHundredths = marked === 0 ? 0 : Math.round(((counts.present + counts.late) * 10000) / marked);
  return { ...counts, marked, percentageHundredths, percentage: `${(percentageHundredths / 100).toFixed(2)}%` };
}

export function summarizeByDate(records: Array<{ date: string; status: AttendanceStatus }>) {
  const summary = calculateAttendanceSummary(records.map((record) => record.status));
  return { ...summary, absentDates: records.filter((record) => record.status === 'ABSENT').map((record) => record.date).sort() };
}

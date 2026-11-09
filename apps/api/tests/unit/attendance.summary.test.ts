import { describe, expect, it } from 'vitest';
import { calculateAttendanceSummary, summarizeByDate } from '../../src/modules/attendance/attendance.summary.js';

describe('attendance summaries', () => {
  it('returns zero percentage for no marked records', () => {
    expect(calculateAttendanceSummary([])).toMatchObject({ marked: 0, percentageHundredths: 0, percentage: '0.00%' });
  });

  it('counts late as present and rounds to two decimal places', () => {
    expect(calculateAttendanceSummary(['PRESENT', 'LATE', 'ABSENT'])).toMatchObject({
      present: 1, late: 1, absent: 1, marked: 3, percentageHundredths: 6667, percentage: '66.67%',
    });
  });

  it('returns absent dates in calendar order', () => {
    expect(summarizeByDate([
      { date: '2026-11-03', status: 'ABSENT' },
      { date: '2026-11-01', status: 'PRESENT' },
    ]).absentDates).toEqual(['2026-11-03']);
  });
});

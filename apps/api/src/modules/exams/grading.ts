export interface GradingBand {
  min_percent: number;
  grade: string;
  grade_point: number;
  remark?: string;
}

export interface GradingSubject {
  subjectId: string;
  maxMarks: number;
  passMarks: number;
}

export interface GradingMark {
  subjectId: string;
  marks: number | null;
  isAbsent: boolean;
}

export interface SubjectGrade {
  subjectId: string;
  obtained: number;
  maxMarks: number;
  percent: number;
  grade: string | null;
  passes: boolean;
  absent: boolean;
}

export interface GradingResult {
  subjects: SubjectGrade[];
  total: number;
  maxTotal: number;
  overallPercent: number;
  grade: string | null;
  result: 'PASS' | 'FAIL' | 'INCOMPLETE';
}

const halfUp = (numerator: number, denominator: number) =>
  denominator === 0 ? 0 : Math.floor((numerator * 2 + denominator) / (2 * denominator));

export function calculatePercent(obtained: number, max: number): number {
  return halfUp(obtained * 10000, max);
}

export function gradeForPercent(percent: number, bands: GradingBand[]): GradingBand | null {
  return [...bands].sort((a, b) => b.min_percent - a.min_percent).find((band) => band.min_percent <= percent) || null;
}

export function gradeMarks(subjects: GradingSubject[], marks: GradingMark[], bands: GradingBand[]): GradingResult {
  const bySubject = new Map(marks.map((mark) => [mark.subjectId, mark]));
  const results: SubjectGrade[] = [];
  let total = 0;
  let maxTotal = 0;
  let incomplete = false;
  for (const subject of subjects) {
    const mark = bySubject.get(subject.subjectId);
    maxTotal += subject.maxMarks;
    if (!mark) {
      incomplete = true;
      results.push({ subjectId: subject.subjectId, obtained: 0, maxMarks: subject.maxMarks, percent: 0, grade: null, passes: false, absent: false });
      continue;
    }
    const absent = mark.isAbsent;
    const obtained = absent ? 0 : (mark.marks ?? 0);
    if (!absent && mark.marks === null) incomplete = true;
    total += obtained;
    const percent = calculatePercent(obtained, subject.maxMarks);
    const band = gradeForPercent(percent, bands);
    results.push({ subjectId: subject.subjectId, obtained, maxMarks: subject.maxMarks, percent, grade: band?.grade || null, passes: !absent && obtained >= subject.passMarks, absent });
  }
  const overallPercent = calculatePercent(total, maxTotal);
  const band = gradeForPercent(overallPercent, bands);
  const lowest = bands.find((item) => item.min_percent === 0);
  const result = incomplete ? 'INCOMPLETE' : results.every((item) => item.passes) && band?.min_percent !== lowest?.min_percent ? 'PASS' : 'FAIL';
  return { subjects: results, total, maxTotal, overallPercent, grade: band?.grade || null, result };
}

export function denseRanks(totals: number[]): number[] {
  const unique = [...new Set(totals)].sort((a, b) => b - a);
  return totals.map((total) => unique.indexOf(total) + 1);
}

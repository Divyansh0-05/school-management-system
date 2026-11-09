import { describe, expect, it } from 'vitest';
import { calculatePercent, denseRanks, gradeMarks } from '../../src/modules/exams/grading.js';

const bands = [
  { min_percent: 9000, grade: 'A', grade_point: 1000 },
  { min_percent: 7500, grade: 'B', grade_point: 800 },
  { min_percent: 4000, grade: 'D', grade_point: 400 },
  { min_percent: 0, grade: 'F', grade_point: 0 },
];
const subjects = [{ subjectId: 'math', maxMarks: 10000, passMarks: 4000 }, { subjectId: 'eng', maxMarks: 10000, passMarks: 4000 }];

describe('exam grading', () => {
  it('uses inclusive boundaries and half-up integer rounding', () => {
    expect(calculatePercent(8999, 10000)).toBe(8999);
    expect(calculatePercent(9000, 10000)).toBe(9000);
    expect(calculatePercent(1, 3)).toBe(3333);
    expect(gradeMarks(subjects, [{ subjectId: 'math', marks: 9000, isAbsent: false }, { subjectId: 'eng', marks: 9000, isAbsent: false }], bands).grade).toBe('A');
    expect(gradeMarks(subjects, [{ subjectId: 'math', marks: 8999, isAbsent: false }, { subjectId: 'eng', marks: 8999, isAbsent: false }], bands).grade).toBe('B');
  });
  it('handles absent, all-fail, mixed pass/fail, custom bands, and missing marks', () => {
    expect(gradeMarks(subjects, [{ subjectId: 'math', marks: null, isAbsent: true }, { subjectId: 'eng', marks: 8000, isAbsent: false }], bands).subjects[0].absent).toBe(true);
    expect(gradeMarks(subjects, [{ subjectId: 'math', marks: 3000, isAbsent: false }, { subjectId: 'eng', marks: 3000, isAbsent: false }], bands).result).toBe('FAIL');
    expect(gradeMarks(subjects, [{ subjectId: 'math', marks: 8000, isAbsent: false }, { subjectId: 'eng', marks: 3000, isAbsent: false }], bands).result).toBe('FAIL');
    expect(gradeMarks(subjects, [{ subjectId: 'math', marks: 8000, isAbsent: false }], bands).result).toBe('INCOMPLETE');
    expect(gradeMarks(subjects, [{ subjectId: 'math', marks: 10000, isAbsent: false }, { subjectId: 'eng', marks: 10000, isAbsent: false }], [{ min_percent: 5000, grade: 'PASS', grade_point: 1000 }, { min_percent: 0, grade: 'FAIL', grade_point: 0 }]).result).toBe('PASS');
  });
  it('assigns dense ranks with ties', () => {
    expect(denseRanks([200, 200, 150, 100, 100])).toEqual([1, 1, 2, 3, 3]);
  });
});

import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a valid MongoDB ObjectId');
const decimal = z.union([
  z.number().finite(),
  z.string().regex(/^\d+(?:\.\d{1,2})?$/, 'Must be a decimal with at most 2 places'),
]);

const gradingBand = z.object({
  min_percent: z.number().int().min(0).max(10000),
  grade: z.string().trim().min(1).max(20),
  grade_point: z.number().int().min(0),
  remark: z.string().trim().min(1).max(120),
});

export const ExamSubjectSchema = z.object({
  subjectId: objectId,
  maxMarks: decimal,
  passMarks: decimal,
});

export const ExamCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  term: z.string().trim().min(1).max(80),
  academicYearId: objectId,
  classId: objectId,
  gradingSchemeId: objectId,
  startsOn: z.coerce.date(),
  examSubjects: z.array(ExamSubjectSchema).min(1),
});

export const ExamUpdateSchema = ExamCreateSchema.partial();
export const ExamQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  classId: objectId.optional(),
  academicYearId: objectId.optional(),
  status: z.enum(['DRAFT', 'MARKS_OPEN', 'LOCKED', 'PUBLISHED']).optional(),
});
export const MarksQuerySchema = z.object({ sectionId: objectId });
export const MarksBodySchema = z.object({
  records: z.array(z.object({ studentId: objectId, marks: decimal.nullable().optional(), isAbsent: z.boolean().default(false) })).min(1),
});
export const SectionResultsQuerySchema = z.object({ sectionId: objectId });
export const ReportCardParamsSchema = z.object({ id: objectId, examId: objectId });
export const TransitionReasonSchema = z.object({ reason: z.string().trim().min(1).max(500).optional() });

export const ExamGradingBandSchema = gradingBand;
export type ExamCreate = z.infer<typeof ExamCreateSchema>;
export type MarksBody = z.infer<typeof MarksBodySchema>;

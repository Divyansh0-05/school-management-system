import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a valid MongoDB ObjectId');
const date = z.coerce.date();

export const MasterQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional(),
  sort: z.string().regex(/^-?[a-zA-Z_]+$/).optional(),
});

export const IdParamsSchema = z.object({ id: objectId });
const name = z.string().trim().min(1).max(120);
const optionalBool = z.boolean().optional();

export const MasterBodySchemas = {
  students: z.object({
    admission_no: z.string().trim().min(1).max(50),
    full_name: name,
    dob: date,
    gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
    status: z.enum(['ACTIVE', 'INACTIVE', 'GRADUATED']).optional(),
  }),
  guardians: z.object({ email: z.string().email(), temporary_password: z.string().min(8).optional(), full_name: name, phone: z.string().trim().min(3), }),
  teachers: z.object({ email: z.string().email(), temporary_password: z.string().min(8).optional(), employee_no: z.string().trim().min(1), full_name: name, phone: z.string().trim().min(3), }),
  classes: z.object({ name, level: z.number().int().min(1).max(20) }),
  sections: z.object({ class_id: objectId, academic_year_id: objectId, name: z.string().trim().min(1).max(20) }),
  subjects: z.object({ code: z.string().trim().min(1).max(30), name }),
  'academic-years': z.object({ name: z.string().trim().min(1), start_date: date, end_date: date, is_current: z.boolean().optional() }),
  enrollments: z.object({ student_id: objectId, section_id: objectId, academic_year_id: objectId, roll_no: z.number().int().min(1) }),
  'teacher-assignments': z.object({ teacher_id: objectId, section_id: objectId, subject_id: objectId, is_class_teacher: z.boolean().optional() }),
  'class-subjects': z.object({ class_id: objectId, subject_id: objectId }),
  'fee-heads': z.object({ name }),
  'grading-schemes': z.object({
    name,
    is_default: z.boolean().optional(),
    grading_bands: z.array(z.object({ min_percent: z.number().int().min(0).max(10000), grade: name, grade_point: z.number().int().min(0), remark: name })).min(1),
  }),
} as const;

export const StudentGuardianBodySchema = z.object({
  guardian_id: objectId,
  relationship: z.string().trim().min(1),
  is_primary: optionalBool,
});

export type MasterResource = keyof typeof MasterBodySchemas;

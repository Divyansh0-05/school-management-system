import { z } from 'zod';
import { StudentStatus, Gender } from '../constants/status.js';

export const StudentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().optional(),
  status: z.enum([StudentStatus.ACTIVE, StudentStatus.INACTIVE, StudentStatus.GRADUATED]).optional(),
});

export type StudentQuery = z.infer<typeof StudentQuerySchema>;

export const StudentResponseSchema = z.object({
  id: z.string(),
  admissionNo: z.string(),
  fullName: z.string(),
  dob: z.string(),
  gender: z.enum([Gender.MALE, Gender.FEMALE, Gender.OTHER]),
  status: z.enum([StudentStatus.ACTIVE, StudentStatus.INACTIVE, StudentStatus.GRADUATED]),
  currentSection: z
    .object({
      id: z.string(),
      name: z.string(),
      className: z.string(),
      rollNo: z.number().int().optional(),
    })
    .optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type StudentResponse = z.infer<typeof StudentResponseSchema>;

export const StudentDetailResponseSchema = StudentResponseSchema.extend({
  guardians: z.array(
    z.object({
      id: z.string(),
      fullName: z.string(),
      phone: z.string(),
      relationship: z.string(),
      isPrimary: z.boolean(),
    })
  ),
  enrollmentHistory: z.array(
    z.object({
      academicYear: z.string(),
      className: z.string(),
      sectionName: z.string(),
      rollNo: z.number().int(),
    })
  ),
});

export type StudentDetailResponse = z.infer<typeof StudentDetailResponseSchema>;


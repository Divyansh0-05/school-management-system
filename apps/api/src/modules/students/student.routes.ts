import { Router } from 'express';
import { StudentQuerySchema } from '@school/shared';
import { studentController } from './student.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';

export const studentRouter = Router();

// Both endpoints are protected by authentication; authorization scoping is applied in the repository layer
studentRouter.use(requireAuth);

studentRouter.get(
  '/',
  validate({ query: StudentQuerySchema }),
  studentController.listStudents
);

studentRouter.get('/:id', studentController.getStudentById);


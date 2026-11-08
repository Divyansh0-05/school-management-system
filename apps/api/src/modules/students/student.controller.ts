import type { Request, Response, NextFunction } from 'express';
import { studentService } from './student.service.js';
import { UnauthorizedError } from '../../errors/appError.js';

export class StudentController {
  async listStudents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;
      const q = req.query.q as string | undefined;
      const status = req.query.status as string | undefined;

      const result = await studentService.listStudents(req.user, {
        page,
        pageSize,
        q,
        status,
      });

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getStudentById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new UnauthorizedError('Authentication required');
      }

      const studentId = req.params.id;
      const student = await studentService.getStudentById(req.user, studentId);

      res.status(200).json({ data: student });
    } catch (err) {
      next(err);
    }
  }
}

export const studentController = new StudentController();


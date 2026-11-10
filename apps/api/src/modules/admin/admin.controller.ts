import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../../errors/appError.js';
import { adminService } from './admin.service.js';

const actor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
};

export const adminController = {
  dashboard: async (req: Request, res: Response, next: NextFunction) => {
    try { res.json({ data: await adminService.dashboard(actor(req)) }); } catch (error) { next(error); }
  },
  auditLogs: async (req: Request, res: Response, next: NextFunction) => {
    try { res.json({ data: await adminService.auditLogs(actor(req), req.query) }); } catch (error) { next(error); }
  },
};

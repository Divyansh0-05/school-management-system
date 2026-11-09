import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../../errors/appError.js';
import { attendanceService } from './attendance.service.js';

const actor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
};
const context = (req: Request) => ({ requestId: String(req.id || 'unknown'), ip: req.ip || 'unknown' });

export const attendanceController = {
  listSections: async (req: Request, res: Response, next: NextFunction) => { try { res.json({ data: await attendanceService.listSections(actor(req)) }); } catch (e) { next(e); } },
  sectionStudents: async (req: Request, res: Response, next: NextFunction) => { try { res.json({ data: await attendanceService.sectionStudents(actor(req), req.params.id) }); } catch (e) { next(e); } },
  getAttendance: async (req: Request, res: Response, next: NextFunction) => { try { res.json({ data: await attendanceService.getAttendance(actor(req), req.params.id, String(req.query.date), String(req.query.session)) }); } catch (e) { next(e); } },
  putAttendance: async (req: Request, res: Response, next: NextFunction) => { try { const c = context(req); res.json({ data: await attendanceService.putAttendance(actor(req), req.params.id, req.body, c.requestId, c.ip) }); } catch (e) { next(e); } },
  postAttendance: async (req: Request, res: Response, next: NextFunction) => { try { const c = context(req); res.status(201).json({ data: await attendanceService.postAttendance(actor(req), req.body, c.requestId, c.ip) }); } catch (e) { next(e); } },
  sectionReport: async (req: Request, res: Response, next: NextFunction) => { try { res.json({ data: await attendanceService.sectionReport(actor(req), String(req.query.sectionId), String(req.query.from), String(req.query.to)) }); } catch (e) { next(e); } },
  studentSummary: async (req: Request, res: Response, next: NextFunction) => { try { res.json({ data: await attendanceService.studentSummary(actor(req), req.params.id, String(req.query.from), String(req.query.to)) }); } catch (e) { next(e); } },
};

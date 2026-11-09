import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../../errors/appError.js';
import { examsService } from './exams.service.js';
const actor = (req: Request) => { if (!req.user) throw new UnauthorizedError(); return req.user; };
const context = (req: Request) => ({ requestId: String(req.id || 'unknown'), ip: req.ip || 'unknown' });
export const examsController = {
  list: async (req: Request, res: Response, next: NextFunction) => { try { res.json(await examsService.list(actor(req), Number(req.query.page), Number(req.query.pageSize))); } catch (e) { next(e); } },
  get: async (req: Request, res: Response, next: NextFunction) => { try { res.json({ data: await examsService.get(req.params.id) }); } catch (e) { next(e); } },
  create: async (req: Request, res: Response, next: NextFunction) => { try { const c = context(req); res.status(201).json({ data: await examsService.create(actor(req), req.body, c.requestId, c.ip) }); } catch (e) { next(e); } },
  update: async (req: Request, res: Response, next: NextFunction) => { try { const c = context(req); res.json({ data: await examsService.update(actor(req), req.params.id, req.body, c.requestId, c.ip) }); } catch (e) { next(e); } },
  remove: async (req: Request, res: Response, next: NextFunction) => { try { const c = context(req); res.json({ data: await examsService.remove(actor(req), req.params.id, c.requestId, c.ip) }); } catch (e) { next(e); } },
  transition: async (req: Request, res: Response, next: NextFunction) => { try { const c = context(req); res.json({ data: await examsService.transitionExam(actor(req), req.params.id, req.params.action, req.body.reason, c.requestId, c.ip) }); } catch (e) { next(e); } },
  marks: async (req: Request, res: Response, next: NextFunction) => { try { res.json({ data: await examsService.marks(actor(req), req.params.examId, req.params.subjectId, String(req.query.sectionId)) }); } catch (e) { next(e); } },
  putMarks: async (req: Request, res: Response, next: NextFunction) => { try { const c = context(req); res.json({ data: await examsService.putMarks(actor(req), req.params.examId, req.params.subjectId, String(req.query.sectionId), req.body, c.requestId, c.ip) }); } catch (e) { next(e); } },
  results: async (req: Request, res: Response, next: NextFunction) => { try { res.json({ data: await examsService.results(actor(req), req.params.id, String(req.query.sectionId)) }); } catch (e) { next(e); } },
  reportCard: async (req: Request, res: Response, next: NextFunction) => { try { res.json({ data: await examsService.reportCard(actor(req), req.params.id, req.params.examId) }); } catch (e) { next(e); } },
  performance: async (req: Request, res: Response, next: NextFunction) => { try { res.json({ data: await examsService.sectionPerformance(actor(req), String(req.query.examId), String(req.query.sectionId)) }); } catch (e) { next(e); } },
};

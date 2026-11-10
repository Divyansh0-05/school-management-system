import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../../errors/appError.js';
import { feesService } from './fees.service.js';
const actor = (req: Request) => { if (!req.user) throw new UnauthorizedError(); return req.user; };
const ctx = (req: Request) => ({ requestId: String(req.id || 'unknown'), ip: req.ip || 'unknown' });
export const feesController = {
  list: async (req: Request, res: Response, next: NextFunction) => { try { res.json(await feesService.list(actor(req), req.query)); } catch (e) { next(e); } },
  get: async (req: Request, res: Response, next: NextFunction) => { try { res.json({ data: await feesService.get(actor(req), req.params.id) }); } catch (e) { next(e); } },
  create: async (req: Request, res: Response, next: NextFunction) => { try { const c = ctx(req); res.status(201).json({ data: await feesService.create(actor(req), req.body, c.requestId, c.ip) }); } catch (e) { next(e); } },
  generate: async (req: Request, res: Response, next: NextFunction) => { try { const c = ctx(req); res.status(201).json({ data: await feesService.generateForSection(actor(req), req.body, c.requestId, c.ip) }); } catch (e) { next(e); } },
  update: async (req: Request, res: Response, next: NextFunction) => { try { const c = ctx(req); res.json({ data: await feesService.update(actor(req), req.params.id, req.body, c.requestId, c.ip) }); } catch (e) { next(e); } },
  issue: async (req: Request, res: Response, next: NextFunction) => { try { const c = ctx(req); res.json({ data: await feesService.issue(actor(req), req.params.id, c.requestId, c.ip) }); } catch (e) { next(e); } },
  void: async (req: Request, res: Response, next: NextFunction) => { try { const c = ctx(req); res.json({ data: await feesService.void(actor(req), req.params.id, req.body.reason, c.requestId, c.ip) }); } catch (e) { next(e); } },
  pay: async (req: Request, res: Response, next: NextFunction) => { try { const c = ctx(req); const result = await feesService.pay(actor(req), req.params.id, req.body, req.header('Idempotency-Key'), c.requestId, c.ip); if (result.idempotentReplay) res.setHeader('Idempotent-Replay', 'true'); res.status(result.idempotentReplay ? 200 : 201).json({ data: result }); } catch (e) { next(e); } },
  payments: async (req: Request, res: Response, next: NextFunction) => { try { res.json(await feesService.payments(actor(req), req.query)); } catch (e) { next(e); } },
  ledger: async (req: Request, res: Response, next: NextFunction) => { try { res.json({ data: await feesService.ledger(actor(req), req.params.id) }); } catch (e) { next(e); } },
  summary: async (req: Request, res: Response, next: NextFunction) => { try { res.json({ data: await feesService.summary(actor(req)) }); } catch (e) { next(e); } },
  reconciliation: async (req: Request, res: Response, next: NextFunction) => { try { res.json({ data: await feesService.reconciliation(actor(req)) }); } catch (e) { next(e); } },
};

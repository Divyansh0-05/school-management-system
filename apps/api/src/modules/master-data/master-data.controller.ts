import type { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../../errors/appError.js';
import { masterDataService } from './master-data.service.js';

const actor = (req: Request) => {
  if (!req.user) throw new UnauthorizedError('Authentication required');
  return req.user;
};
const context = (req: Request) => ({ requestId: String(req.id || 'unknown'), ip: req.ip || 'unknown' });

export class MasterDataController {
  list = async (req: Request, res: Response, next: NextFunction) => { try { res.json(await masterDataService.list(actor(req), req.params.resource as string, req.query as unknown as { page: number; pageSize: number; q?: string; sort?: string })); } catch (e) { next(e); } };
  get = async (req: Request, res: Response, next: NextFunction) => { try { res.json({ data: await masterDataService.get(actor(req), req.params.resource as string, req.params.id as string) }); } catch (e) { next(e); } };
  create = async (req: Request, res: Response, next: NextFunction) => { try { const result = await masterDataService.create(actor(req), req.params.resource as string, req.body, context(req).requestId, context(req).ip); res.status(201).json({ data: result }); } catch (e) { next(e); } };
  update = async (req: Request, res: Response, next: NextFunction) => { try { const result = await masterDataService.update(actor(req), req.params.resource as string, req.params.id as string, req.body, context(req).requestId, context(req).ip); res.json({ data: result }); } catch (e) { next(e); } };
  deactivate = async (req: Request, res: Response, next: NextFunction) => { try { const result = await masterDataService.deactivate(actor(req), req.params.resource as string, req.params.id as string, context(req).requestId, context(req).ip); res.json({ data: result }); } catch (e) { next(e); } };
  linkGuardian = async (req: Request, res: Response, next: NextFunction) => { try { const result = await masterDataService.linkGuardian(actor(req), req.params.id as string, req.body, context(req).requestId, context(req).ip); res.status(201).json({ data: result }); } catch (e) { next(e); } };
  unlinkGuardian = async (req: Request, res: Response, next: NextFunction) => { try { const result = await masterDataService.unlinkGuardian(actor(req), req.params.id as string, req.params.guardianId as string, context(req).requestId, context(req).ip); res.json({ data: result }); } catch (e) { next(e); } };
}
export const masterDataController = new MasterDataController();

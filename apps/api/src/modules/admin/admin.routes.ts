import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { adminController } from './admin.controller.js';

export const adminRouter = Router();
adminRouter.use(requireAuth);
adminRouter.get('/dashboard/admin', adminController.dashboard);
adminRouter.get('/audit-logs', adminController.auditLogs);

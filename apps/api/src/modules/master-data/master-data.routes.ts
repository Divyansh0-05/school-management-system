import { Router } from 'express';
import { IdParamsSchema, MasterBodySchemas, MasterQuerySchema, StudentGuardianBodySchema } from '@school/shared';
import { UserRole } from '@school/shared';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { masterDataController } from './master-data.controller.js';

export const masterDataRouter = Router();
masterDataRouter.use(requireAuth, requireRole(UserRole.ADMIN));
const resources = Object.keys(MasterBodySchemas);
for (const resource of resources) {
  const base = `/${resource}`;
  const setResource = (req: Parameters<typeof masterDataController.list>[0], _res: Parameters<typeof masterDataController.list>[1], next: Parameters<typeof masterDataController.list>[2]) => {
    req.params.resource = resource;
    next();
  };
  masterDataRouter.get(base, validate({ query: MasterQuerySchema }), setResource, masterDataController.list);
  masterDataRouter.get(`${base}/:id`, validate({ params: IdParamsSchema }), setResource, masterDataController.get);
  masterDataRouter.post(base, validate({ body: MasterBodySchemas[resource as keyof typeof MasterBodySchemas] }), setResource, masterDataController.create);
  masterDataRouter.patch(`${base}/:id`, validate({ params: IdParamsSchema, body: MasterBodySchemas[resource as keyof typeof MasterBodySchemas].partial() }), setResource, masterDataController.update);
  masterDataRouter.delete(`${base}/:id`, validate({ params: IdParamsSchema }), setResource, masterDataController.deactivate);
}
masterDataRouter.post('/students/:id/guardians', validate({ params: IdParamsSchema, body: StudentGuardianBodySchema }), masterDataController.linkGuardian);
masterDataRouter.delete('/students/:id/guardians/:guardianId', validate({ params: IdParamsSchema.extend({ guardianId: IdParamsSchema.shape.id }) }), masterDataController.unlinkGuardian);

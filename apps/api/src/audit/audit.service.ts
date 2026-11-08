import { ClientSession } from 'mongoose';
import { UserRole } from '@school/shared';
import { auditRepository } from './audit.repository.js';
import { AuthTokenPayload } from '../modules/auth/auth.tokens.js';
import { logger } from '../utils/logger.js';

export interface AuditEventParams {
  actor: AuthTokenPayload;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  requestId: string;
  ip: string;
  session?: ClientSession;
}

export class AuditService {
  /**
   * Records an audit log entry in the database.
   * If a transaction session is provided, the audit log commits atomically with the business mutation.
   */
  async record(params: AuditEventParams) {
    try {
      const entry = await auditRepository.create(
        {
          actor_user_id: params.actor.sub,
          actor_role: params.actor.role as UserRole,
          action: params.action,
          entity_type: params.entityType,
          entity_id: params.entityId,
          before: params.before || null,
          after: params.after || null,
          request_id: params.requestId,
          ip: params.ip,
          at: new Date(),
        },
        params.session
      );
      return entry;
    } catch (err) {
      logger.error({ err, params }, 'Failed to write audit log entry');
      throw err;
    }
  }

  async getLogs(options: {
    actorId?: string;
    entityType?: string;
    entityId?: string;
    action?: string;
    from?: Date;
    to?: Date;
    page?: number;
    pageSize?: number;
  }) {
    return auditRepository.find({
      actor_user_id: options.actorId,
      entity_type: options.entityType,
      entity_id: options.entityId,
      action: options.action,
      from: options.from,
      to: options.to,
      page: options.page,
      pageSize: options.pageSize,
    });
  }
}

export const auditService = new AuditService();

/**
 * Universal helper that all mutating services MUST call within their transactions.
 */
export async function recordAuditLog(params: AuditEventParams) {
  return auditService.record(params);
}


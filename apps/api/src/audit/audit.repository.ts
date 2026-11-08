import { ClientSession, FilterQuery } from 'mongoose';
import { AuditLog, IAuditLog } from '../models/AuditLog.js';
import { UserRole } from '@school/shared';

export interface CreateAuditLogParams {
  actor_user_id: string;
  actor_role: UserRole;
  action: string;
  entity_type: string;
  entity_id: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  request_id: string;
  ip: string;
  at?: Date;
}

export interface AuditQueryOptions {
  actor_user_id?: string;
  entity_type?: string;
  entity_id?: string;
  action?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

export class AuditRepository {
  /**
   * Append-only: creates an audit log entry. Supports transaction session.
   */
  async create(
    params: CreateAuditLogParams,
    session?: ClientSession
  ): Promise<IAuditLog> {
    const docs = await AuditLog.create([params], { session });
    return docs[0];
  }

  /**
   * Read-only: queries audit logs with filters and pagination.
   */
  async find(
    options: AuditQueryOptions
  ): Promise<{ logs: IAuditLog[]; total: number }> {
    const query: FilterQuery<IAuditLog> = {};

    if (options.actor_user_id) query.actor_user_id = options.actor_user_id;
    if (options.entity_type) query.entity_type = options.entity_type;
    if (options.entity_id) query.entity_id = options.entity_id;
    if (options.action) query.action = options.action;

    if (options.from || options.to) {
      query.at = {};
      if (options.from) query.at.$gte = options.from;
      if (options.to) query.at.$lte = options.to;
    }

    const page = options.page || 1;
    const pageSize = options.pageSize || 50;
    const skip = (page - 1) * pageSize;

    const [logs, total] = await Promise.all([
      AuditLog.find(query).sort({ at: -1 }).skip(skip).limit(pageSize),
      AuditLog.countDocuments(query),
    ]);

    return { logs, total };
  }
}

export const auditRepository = new AuditRepository();


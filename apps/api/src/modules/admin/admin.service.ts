import { AttendanceRecord, AuditLog, Student, type IAuditLog } from '../../models/index.js';
import { auditRepository } from '../../audit/audit.repository.js';
import { ForbiddenError } from '../../errors/appError.js';
import { StudentStatus, UserRole } from '@school/shared';
import type { AuthTokenPayload } from '../auth/auth.tokens.js';
import { feesService } from '../fees/fees.service.js';

interface AuditQuery {
  page?: string | number;
  pageSize?: string | number;
  actor?: string;
  entityType?: string;
  action?: string;
  from?: string;
  to?: string;
}

function adminOnly(actor: AuthTokenPayload) {
  if (actor.role !== UserRole.ADMIN) throw new ForbiddenError('Administrator role required', 'ROLE_NOT_PERMITTED');
}

export const adminService = {
  async dashboard(actor: AuthTokenPayload) {
    adminOnly(actor);
    const today = new Date().toISOString().slice(0, 10);
    const [activeStudents, attendance, recentAudit] = await Promise.all([
      Student.countDocuments({ status: StudentStatus.ACTIVE }),
      AttendanceRecord.find({ date: today }).select('status').lean(),
      AuditLog.find({}).sort({ at: -1 }).limit(10).lean(),
    ]);
    const marked = attendance.length;
    const present = attendance.filter((row) => row.status === 'PRESENT' || row.status === 'LATE').length;
    const fees = await feesService.summary(actor);
    return {
      activeStudents,
      attendance: { marked, percentageHundredths: marked ? Math.round((present * 10000) / marked) : 0 },
      fees,
      recentAudit,
    };
  },
  async auditLogs(actor: AuthTokenPayload, input: AuditQuery) {
    adminOnly(actor);
    const page = Math.max(1, Number(input.page || 1));
    const pageSize = Math.min(100, Math.max(1, Number(input.pageSize || 20)));
    const result = await auditRepository.find({
      page, pageSize, actor_user_id: input.actor, entity_type: input.entityType, action: input.action,
      from: input.from ? new Date(input.from) : undefined, to: input.to ? new Date(input.to) : undefined,
    });
    const logs = result.logs.map((doc: IAuditLog) => ({
      id: String(doc._id),
      _id: String(doc._id),
      at: doc.at instanceof Date ? doc.at.toISOString() : (doc.at ? String(doc.at) : ''),
      actor_user_id: doc.actor_user_id ? String(doc.actor_user_id) : '',
      actor_role: String(doc.actor_role || ''),
      action: String(doc.action || ''),
      entity_type: String(doc.entity_type || ''),
      entity_id: String(doc.entity_id || ''),
      request_id: String(doc.request_id || ''),
      ip: String(doc.ip || ''),
      before: doc.before || null,
      after: doc.after || null,
    }));
    return { data: logs, meta: { page, pageSize, total: result.total, totalPages: Math.ceil(result.total / pageSize) || 1 } };
  },
};

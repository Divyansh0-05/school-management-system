import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestDb, teardownTestDb } from '../helpers/testDb.js';
import { recordAuditLog, auditService } from '../../src/audit/audit.service.js';
import { auditRepository } from '../../src/audit/audit.repository.js';
import { AuditLog } from '../../src/models/AuditLog.js';
import { UserRole } from '@school/shared';
import { withTransaction } from '../../src/db/connection.js';

describe('Audit Trail Immutability & Transactional Guarantees', () => {
  beforeAll(async () => {
    await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('records an audit log entry in the same transaction as a business mutation', async () => {
    const actor = {
      sub: '507f1f77bcf86cd799439011',
      email: 'admin@school.demo',
      role: UserRole.ADMIN,
      fullName: 'Administrator',
    };

    const entry = await withTransaction(async (session) => {
      return recordAuditLog({
        actor,
        action: 'TEST_MUTATION',
        entityType: 'TEST_ENTITY',
        entityId: 'ent-12345',
        before: { status: 'OLD' },
        after: { status: 'NEW' },
        requestId: 'req-test-uuid',
        ip: '127.0.0.1',
        session,
      });
    });

    expect(entry).toBeDefined();
    expect(entry.action).toBe('TEST_MUTATION');
    expect(entry.before).toEqual({ status: 'OLD' });
    expect(entry.after).toEqual({ status: 'NEW' });

    // Verify stored in DB
    const fetched = await auditService.getLogs({
      entityType: 'TEST_ENTITY',
      entityId: 'ent-12345',
    });
    expect(fetched.total).toBeGreaterThanOrEqual(1);
    expect(fetched.logs[0].entity_id).toBe('ent-12345');
  });

  it('proves auditRepository is append-only with no update or delete methods', () => {
    const repoMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(auditRepository));
    expect(repoMethods).toContain('create');
    expect(repoMethods).toContain('find');
    expect(repoMethods).not.toContain('update');
    expect(repoMethods).not.toContain('updateOne');
    expect(repoMethods).not.toContain('updateMany');
    expect(repoMethods).not.toContain('delete');
    expect(repoMethods).not.toContain('deleteOne');
    expect(repoMethods).not.toContain('deleteMany');
  });

  it('blocks direct Mongoose update attempts via schema immutability middleware', async () => {
    await expect(
      AuditLog.updateOne({ entity_id: 'ent-12345' }, { $set: { action: 'TAMPERED' } })
    ).rejects.toThrow(/Audit log is immutable: updates and deletions are strictly forbidden/);
  });

  it('blocks direct Mongoose delete attempts via schema immutability middleware', async () => {
    await expect(
      AuditLog.deleteOne({ entity_id: 'ent-12345' })
    ).rejects.toThrow(/Audit log is immutable: updates and deletions are strictly forbidden/);
  });
});


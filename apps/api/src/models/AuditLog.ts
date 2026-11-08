import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { UserRole } from '@school/shared';

export interface IAuditLog extends Document {
  at: Date;
  actor_user_id: Types.ObjectId;
  actor_role: UserRole;
  action: string;
  entity_type: string;
  entity_id: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  request_id: string;
  ip: string;
  createdAt: Date;
  updatedAt: Date;
}

export const AuditLogJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'at',
      'actor_user_id',
      'actor_role',
      'action',
      'entity_type',
      'entity_id',
      'request_id',
      'ip',
    ],
    properties: {
      at: { bsonType: 'date' },
      actor_user_id: { bsonType: 'objectId' },
      actor_role: { enum: [UserRole.ADMIN, UserRole.TEACHER, UserRole.GUARDIAN] },
      action: { bsonType: 'string' },
      entity_type: { bsonType: 'string' },
      entity_id: { bsonType: 'string' },
      before: { bsonType: ['object', 'null'] },
      after: { bsonType: ['object', 'null'] },
      request_id: { bsonType: 'string' },
      ip: { bsonType: 'string' },
    },
  },
};

const auditLogSchema = new Schema<IAuditLog>(
  {
    at: {
      type: Date,
      default: Date.now,
      index: true,
    },
    actor_user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    actor_role: {
      type: String,
      enum: Object.values(UserRole),
      required: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    entity_type: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    entity_id: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    before: {
      type: Schema.Types.Mixed,
      default: null,
    },
    after: {
      type: Schema.Types.Mixed,
      default: null,
    },
    request_id: {
      type: String,
      required: true,
      trim: true,
    },
    ip: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

// Compound entity index for audit querying
auditLogSchema.index({ entity_type: 1, entity_id: 1, at: -1 });

// Prevent updates and deletes at Mongoose schema middleware level (append-only enforcement)
auditLogSchema.pre(
  ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndDelete'],
  function (next) {
    next(new Error('Audit log is immutable: updates and deletions are strictly forbidden'));
  }
);

export const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', auditLogSchema, 'audit_logs');


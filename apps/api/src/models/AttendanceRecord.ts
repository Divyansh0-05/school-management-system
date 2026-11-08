import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { AttendanceStatus, AttendanceSession } from '@school/shared';

export interface IAttendanceRecord extends Document {
  student_id: Types.ObjectId;
  section_id: Types.ObjectId;
  date: string; // ISO date format YYYY-MM-DD
  session: AttendanceSession;
  status: AttendanceStatus;
  marked_by_user_id: Types.ObjectId;
  marked_at: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const AttendanceRecordJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['student_id', 'section_id', 'date', 'session', 'status', 'marked_by_user_id'],
    properties: {
      student_id: { bsonType: 'objectId', description: 'must be an objectId and is required' },
      section_id: { bsonType: 'objectId', description: 'must be an objectId and is required' },
      date: {
        bsonType: 'string',
        pattern: '^\\d{4}-\\d{2}-\\d{2}$',
        description: 'must be a string formatted as YYYY-MM-DD',
      },
      session: {
        enum: [AttendanceSession.MORNING, AttendanceSession.AFTERNOON],
        description: 'must be MORNING or AFTERNOON',
      },
      status: {
        enum: [
          AttendanceStatus.PRESENT,
          AttendanceStatus.ABSENT,
          AttendanceStatus.LATE,
          AttendanceStatus.EXCUSED,
        ],
        description: 'must be one of PRESENT, ABSENT, LATE, or EXCUSED',
      },
      marked_by_user_id: {
        bsonType: 'objectId',
        description: 'must be an objectId of the recording user',
      },
      marked_at: { bsonType: 'date', description: 'timestamp when recorded' },
    },
  },
};

const attendanceRecordSchema = new Schema<IAttendanceRecord>(
  {
    student_id: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    section_id: {
      type: Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
      index: true,
    },
    date: {
      type: String,
      required: true,
      trim: true,
    },
    session: {
      type: String,
      enum: Object.values(AttendanceSession),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(AttendanceStatus),
      required: true,
    },
    marked_by_user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    marked_at: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Unique student per date per session (A2 defence)
attendanceRecordSchema.index({ student_id: 1, date: 1, session: 1 }, { unique: true });

// Query indexes per brief
attendanceRecordSchema.index({ section_id: 1, date: 1, session: 1 });
attendanceRecordSchema.index({ student_id: 1, date: 1 });

export const AttendanceRecord: Model<IAttendanceRecord> =
  mongoose.models.AttendanceRecord ||
  mongoose.model<IAttendanceRecord>(
    'AttendanceRecord',
    attendanceRecordSchema,
    'attendance_records'
  );


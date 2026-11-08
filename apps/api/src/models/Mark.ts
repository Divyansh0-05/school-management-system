import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IMark extends Document {
  exam_id: Types.ObjectId;
  subject_id: Types.ObjectId;
  student_id: Types.ObjectId;
  marks_obtained: number | null; // Integer hundredths (e.g. 8550 for 85.50)
  is_absent: boolean;
  entered_by_user_id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export const MarkJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['exam_id', 'subject_id', 'student_id', 'is_absent', 'entered_by_user_id'],
    properties: {
      exam_id: { bsonType: 'objectId', description: 'must be an objectId' },
      subject_id: { bsonType: 'objectId', description: 'must be an objectId' },
      student_id: { bsonType: 'objectId', description: 'must be an objectId' },
      marks_obtained: {
        bsonType: ['int', 'null'],
        minimum: 0,
        description: 'marks obtained in hundredths or null if absent',
      },
      is_absent: { bsonType: 'bool', description: 'boolean flag indicating absence' },
      entered_by_user_id: { bsonType: 'objectId', description: 'must be an objectId' },
    },
  },
};

const markSchema = new Schema<IMark>(
  {
    exam_id: {
      type: Schema.Types.ObjectId,
      ref: 'Exam',
      required: true,
      index: true,
    },
    subject_id: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
      index: true,
    },
    student_id: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    marks_obtained: {
      type: Number,
      default: null,
      min: 0,
    },
    is_absent: {
      type: Boolean,
      default: false,
    },
    entered_by_user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Unique student mark per exam subject
markSchema.index({ exam_id: 1, subject_id: 1, student_id: 1 }, { unique: true });

export const Mark: Model<IMark> =
  mongoose.models.Mark || mongoose.model<IMark>('Mark', markSchema, 'marks');


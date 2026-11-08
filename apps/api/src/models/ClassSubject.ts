import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IClassSubject extends Document {
  class_id: Types.ObjectId;
  subject_id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export const ClassSubjectJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['class_id', 'subject_id'],
    properties: {
      class_id: { bsonType: 'objectId', description: 'must be an objectId and is required' },
      subject_id: { bsonType: 'objectId', description: 'must be an objectId and is required' },
    },
  },
};

const classSubjectSchema = new Schema<IClassSubject>(
  {
    class_id: {
      type: Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
      index: true,
    },
    subject_id: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Compound unique on (class_id, subject_id)
classSubjectSchema.index({ class_id: 1, subject_id: 1 }, { unique: true });

export const ClassSubject: Model<IClassSubject> =
  mongoose.models.ClassSubject ||
  mongoose.model<IClassSubject>('ClassSubject', classSubjectSchema, 'class_subjects');


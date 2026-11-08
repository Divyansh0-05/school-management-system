import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IStudentGuardian extends Document {
  student_id: Types.ObjectId;
  guardian_id: Types.ObjectId;
  relationship: string;
  is_primary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const StudentGuardianJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['student_id', 'guardian_id', 'relationship', 'is_primary'],
    properties: {
      student_id: { bsonType: 'objectId', description: 'must be an objectId and is required' },
      guardian_id: { bsonType: 'objectId', description: 'must be an objectId and is required' },
      relationship: { bsonType: 'string', description: 'must be a string and is required' },
      is_primary: { bsonType: 'bool', description: 'must be a boolean' },
    },
  },
};

const studentGuardianSchema = new Schema<IStudentGuardian>(
  {
    student_id: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    guardian_id: {
      type: Schema.Types.ObjectId,
      ref: 'Guardian',
      required: true,
    },
    relationship: {
      type: String,
      required: true,
      trim: true,
    },
    is_primary: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Compound unique on (student_id, guardian_id)
studentGuardianSchema.index({ student_id: 1, guardian_id: 1 }, { unique: true });

// Partial unique on student_id where is_primary is true (at most one primary guardian per student)
studentGuardianSchema.index(
  { student_id: 1 },
  { unique: true, partialFilterExpression: { is_primary: true } }
);

export const StudentGuardian: Model<IStudentGuardian> =
  mongoose.models.StudentGuardian ||
  mongoose.model<IStudentGuardian>('StudentGuardian', studentGuardianSchema, 'student_guardians');


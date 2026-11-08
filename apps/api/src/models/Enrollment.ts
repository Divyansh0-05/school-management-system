import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IEnrollment extends Document {
  student_id: Types.ObjectId;
  section_id: Types.ObjectId;
  academic_year_id: Types.ObjectId;
  roll_no: number;
  createdAt: Date;
  updatedAt: Date;
}

export const EnrollmentJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['student_id', 'section_id', 'academic_year_id', 'roll_no'],
    properties: {
      student_id: { bsonType: 'objectId', description: 'must be an objectId and is required' },
      section_id: { bsonType: 'objectId', description: 'must be an objectId and is required' },
      academic_year_id: { bsonType: 'objectId', description: 'must be an objectId and is required' },
      roll_no: { bsonType: 'int', minimum: 1, description: 'must be a positive integer roll number' },
    },
  },
};

const enrollmentSchema = new Schema<IEnrollment>(
  {
    student_id: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    section_id: {
      type: Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
    },
    academic_year_id: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: true,
      index: true,
    },
    roll_no: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { timestamps: true }
);

// Unique student enrollment per academic year
enrollmentSchema.index({ student_id: 1, academic_year_id: 1 }, { unique: true });

// Unique roll number per section
enrollmentSchema.index({ section_id: 1, roll_no: 1 }, { unique: true });

export const Enrollment: Model<IEnrollment> =
  mongoose.models.Enrollment ||
  mongoose.model<IEnrollment>('Enrollment', enrollmentSchema, 'enrollments');


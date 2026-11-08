import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IAcademicYear extends Document {
  name: string;
  start_date: Date;
  end_date: Date;
  is_current: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const AcademicYearJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['name', 'start_date', 'end_date', 'is_current'],
    properties: {
      name: { bsonType: 'string', description: 'must be a string and is required' },
      start_date: { bsonType: 'date', description: 'must be a valid date and is required' },
      end_date: { bsonType: 'date', description: 'must be a valid date and is required' },
      is_current: { bsonType: 'bool', description: 'must be a boolean' },
    },
  },
};

const academicYearSchema = new Schema<IAcademicYear>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    start_date: {
      type: Date,
      required: true,
    },
    end_date: {
      type: Date,
      required: true,
    },
    is_current: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// At most one current academic year via partial unique index
academicYearSchema.index(
  { is_current: 1 },
  { unique: true, partialFilterExpression: { is_current: true } }
);

export const AcademicYear: Model<IAcademicYear> =
  mongoose.models.AcademicYear ||
  mongoose.model<IAcademicYear>('AcademicYear', academicYearSchema, 'academic_years');


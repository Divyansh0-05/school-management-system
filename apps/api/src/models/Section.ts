import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ISection extends Document {
  class_id: Types.ObjectId;
  academic_year_id: Types.ObjectId;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export const SectionJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['class_id', 'academic_year_id', 'name'],
    properties: {
      class_id: { bsonType: 'objectId', description: 'must be an objectId and is required' },
      academic_year_id: { bsonType: 'objectId', description: 'must be an objectId and is required' },
      name: { bsonType: 'string', description: 'must be a string and is required' },
    },
  },
};

const sectionSchema = new Schema<ISection>(
  {
    class_id: {
      type: Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
      index: true,
    },
    academic_year_id: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

// Compound unique on (class_id, academic_year_id, name)
sectionSchema.index({ class_id: 1, academic_year_id: 1, name: 1 }, { unique: true });

export const Section: Model<ISection> =
  mongoose.models.Section || mongoose.model<ISection>('Section', sectionSchema, 'sections');


import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISubject extends Document {
  code: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export const SubjectJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['code', 'name'],
    properties: {
      code: { bsonType: 'string', description: 'must be a string and is required' },
      name: { bsonType: 'string', description: 'must be a string and is required' },
    },
  },
};

const subjectSchema = new Schema<ISubject>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

export const Subject: Model<ISubject> =
  mongoose.models.Subject || mongoose.model<ISubject>('Subject', subjectSchema, 'subjects');


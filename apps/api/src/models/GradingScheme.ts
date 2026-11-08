import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IGradingBand {
  min_percent: number; // Integer hundredths (0 to 10000)
  grade: string;
  grade_point: number; // Integer hundredths (e.g. 400 for 4.0)
  remark: string;
}

export interface IGradingScheme extends Document {
  name: string;
  is_default: boolean;
  grading_bands: IGradingBand[];
  createdAt: Date;
  updatedAt: Date;
}

export const GradingSchemeJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['name', 'is_default', 'grading_bands'],
    properties: {
      name: { bsonType: 'string', description: 'must be a string and is required' },
      is_default: { bsonType: 'bool', description: 'must be a boolean' },
      grading_bands: {
        bsonType: 'array',
        items: {
          bsonType: 'object',
          required: ['min_percent', 'grade', 'grade_point', 'remark'],
          properties: {
            min_percent: {
              bsonType: 'int',
              minimum: 0,
              maximum: 10000,
              description: 'minimum percentage in hundredths (0-10000)',
            },
            grade: { bsonType: 'string', description: 'grade label' },
            grade_point: { bsonType: 'int', minimum: 0, description: 'grade point in hundredths' },
            remark: { bsonType: 'string', description: 'remark description' },
          },
        },
      },
    },
  },
};

const gradingBandSchema = new Schema<IGradingBand>(
  {
    min_percent: {
      type: Number,
      required: true,
      min: 0,
      max: 10000,
    },
    grade: {
      type: String,
      required: true,
      trim: true,
    },
    grade_point: {
      type: Number,
      required: true,
      min: 0,
    },
    remark: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const gradingSchemeSchema = new Schema<IGradingScheme>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    is_default: {
      type: Boolean,
      default: false,
    },
    grading_bands: {
      type: [gradingBandSchema],
      required: true,
      validate: [
        (bands: IGradingBand[]) => bands && bands.length > 0,
        'At least one grading band is required',
      ],
    },
  },
  { timestamps: true }
);

export const GradingScheme: Model<IGradingScheme> =
  mongoose.models.GradingScheme ||
  mongoose.model<IGradingScheme>('GradingScheme', gradingSchemeSchema, 'grading_schemes');


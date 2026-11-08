import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { ExamStatus } from '@school/shared';

export interface IExamSubject {
  subject_id: Types.ObjectId;
  max_marks: number; // Integer hundredths (e.g. 10000 for 100.00)
  pass_marks: number; // Integer hundredths (e.g. 4000 for 40.00)
}

export interface IExam extends Document {
  name: string;
  term: string;
  academic_year_id: Types.ObjectId;
  class_id: Types.ObjectId;
  grading_scheme_id: Types.ObjectId;
  grading_snapshot: Record<string, unknown> | null;
  status: ExamStatus;
  starts_on: Date;
  published_at: Date | null;
  exam_subjects: IExamSubject[];
  createdAt: Date;
  updatedAt: Date;
}

export const ExamJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'name',
      'term',
      'academic_year_id',
      'class_id',
      'grading_scheme_id',
      'status',
      'starts_on',
      'exam_subjects',
    ],
    properties: {
      name: { bsonType: 'string', description: 'must be a string and is required' },
      term: { bsonType: 'string', description: 'must be a string and is required' },
      academic_year_id: { bsonType: 'objectId', description: 'must be an objectId' },
      class_id: { bsonType: 'objectId', description: 'must be an objectId' },
      grading_scheme_id: { bsonType: 'objectId', description: 'must be an objectId' },
      grading_snapshot: { bsonType: ['object', 'null'], description: 'embedded snapshot upon lock' },
      status: {
        enum: [ExamStatus.DRAFT, ExamStatus.MARKS_OPEN, ExamStatus.LOCKED, ExamStatus.PUBLISHED],
        description: 'valid exam lifecycle status',
      },
      starts_on: { bsonType: 'date', description: 'must be a valid date' },
      published_at: { bsonType: ['date', 'null'], description: 'timestamp when published' },
      exam_subjects: {
        bsonType: 'array',
        items: {
          bsonType: 'object',
          required: ['subject_id', 'max_marks', 'pass_marks'],
          properties: {
            subject_id: { bsonType: 'objectId' },
            max_marks: { bsonType: 'int', minimum: 1 },
            pass_marks: { bsonType: 'int', minimum: 1 },
          },
        },
      },
    },
  },
};

const examSubjectSchema = new Schema<IExamSubject>(
  {
    subject_id: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
    },
    max_marks: {
      type: Number,
      required: true,
      min: 1,
    },
    pass_marks: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false }
);

const examSchema = new Schema<IExam>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    term: {
      type: String,
      required: true,
      trim: true,
    },
    academic_year_id: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: true,
      index: true,
    },
    class_id: {
      type: Schema.Types.ObjectId,
      ref: 'Class',
      required: true,
      index: true,
    },
    grading_scheme_id: {
      type: Schema.Types.ObjectId,
      ref: 'GradingScheme',
      required: true,
      index: true,
    },
    grading_snapshot: {
      type: Schema.Types.Mixed,
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(ExamStatus),
      default: ExamStatus.DRAFT,
      index: true,
    },
    starts_on: {
      type: Date,
      required: true,
    },
    published_at: {
      type: Date,
      default: null,
    },
    exam_subjects: {
      type: [examSubjectSchema],
      required: true,
      validate: [
        (subjects: IExamSubject[]) => subjects && subjects.length > 0,
        'At least one exam subject is required',
      ],
    },
  },
  { timestamps: true }
);

export const Exam: Model<IExam> =
  mongoose.models.Exam || mongoose.model<IExam>('Exam', examSchema, 'exams');


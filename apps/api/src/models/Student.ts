import mongoose, { Schema, Document, Model } from 'mongoose';
import { StudentStatus, Gender } from '@school/shared';

export interface IStudent extends Document {
  admission_no: string;
  full_name: string;
  dob: Date;
  gender: Gender;
  status: StudentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export const StudentJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['admission_no', 'full_name', 'dob', 'gender', 'status'],
    properties: {
      admission_no: { bsonType: 'string', description: 'must be a string and is required' },
      full_name: { bsonType: 'string', description: 'must be a string and is required' },
      dob: { bsonType: 'date', description: 'must be a valid date and is required' },
      gender: {
        enum: [Gender.MALE, Gender.FEMALE, Gender.OTHER],
        description: 'must be MALE, FEMALE, or OTHER',
      },
      status: {
        enum: [StudentStatus.ACTIVE, StudentStatus.INACTIVE, StudentStatus.GRADUATED],
        description: 'must be ACTIVE, INACTIVE, or GRADUATED',
      },
    },
  },
};

const studentSchema = new Schema<IStudent>(
  {
    admission_no: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    full_name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    dob: {
      type: Date,
      required: true,
    },
    gender: {
      type: String,
      enum: Object.values(Gender),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(StudentStatus),
      default: StudentStatus.ACTIVE,
      index: true,
    },
  },
  { timestamps: true }
);

export const Student: Model<IStudent> =
  mongoose.models.Student || mongoose.model<IStudent>('Student', studentSchema, 'students');


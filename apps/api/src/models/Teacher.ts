import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ITeacher extends Document {
  user_id: Types.ObjectId;
  employee_no: string;
  full_name: string;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
}

export const TeacherJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['user_id', 'employee_no', 'full_name', 'phone'],
    properties: {
      user_id: { bsonType: 'objectId', description: 'must be an objectId and is required' },
      employee_no: { bsonType: 'string', description: 'must be a string and is required' },
      full_name: { bsonType: 'string', description: 'must be a string and is required' },
      phone: { bsonType: 'string', description: 'must be a string and is required' },
    },
  },
};

const teacherSchema = new Schema<ITeacher>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    employee_no: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    full_name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

export const Teacher: Model<ITeacher> =
  mongoose.models.Teacher || mongoose.model<ITeacher>('Teacher', teacherSchema, 'teachers');


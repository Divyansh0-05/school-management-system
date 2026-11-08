import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ITeacherAssignment extends Document {
  teacher_id: Types.ObjectId;
  section_id: Types.ObjectId;
  subject_id: Types.ObjectId;
  is_class_teacher: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const TeacherAssignmentJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['teacher_id', 'section_id', 'subject_id', 'is_class_teacher'],
    properties: {
      teacher_id: { bsonType: 'objectId', description: 'must be an objectId and is required' },
      section_id: { bsonType: 'objectId', description: 'must be an objectId and is required' },
      subject_id: { bsonType: 'objectId', description: 'must be an objectId and is required' },
      is_class_teacher: { bsonType: 'bool', description: 'must be a boolean' },
    },
  },
};

const teacherAssignmentSchema = new Schema<ITeacherAssignment>(
  {
    teacher_id: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      required: true,
    },
    section_id: {
      type: Schema.Types.ObjectId,
      ref: 'Section',
      required: true,
    },
    subject_id: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: true,
      index: true,
    },
    is_class_teacher: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Unique assignment per (teacher, section, subject)
teacherAssignmentSchema.index(
  { teacher_id: 1, section_id: 1, subject_id: 1 },
  { unique: true }
);

// At most one class teacher per section
teacherAssignmentSchema.index(
  { section_id: 1 },
  { unique: true, partialFilterExpression: { is_class_teacher: true } }
);

export const TeacherAssignment: Model<ITeacherAssignment> =
  mongoose.models.TeacherAssignment ||
  mongoose.model<ITeacherAssignment>(
    'TeacherAssignment',
    teacherAssignmentSchema,
    'teacher_assignments'
  );


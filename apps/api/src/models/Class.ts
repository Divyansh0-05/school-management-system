import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IClass extends Document {
  name: string;
  level: number;
  createdAt: Date;
  updatedAt: Date;
}

export const ClassJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['name', 'level'],
    properties: {
      name: { bsonType: 'string', description: 'must be a string and is required' },
      level: { bsonType: 'int', description: 'must be an integer and is required' },
    },
  },
};

const classSchema = new Schema<IClass>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    level: {
      type: Number,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

export const Class: Model<IClass> =
  mongoose.models.Class || mongoose.model<IClass>('Class', classSchema, 'classes');


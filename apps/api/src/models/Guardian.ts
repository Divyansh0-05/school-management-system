import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface IGuardian extends Document {
  user_id: Types.ObjectId;
  full_name: string;
  phone: string;
  createdAt: Date;
  updatedAt: Date;
}

export const GuardianJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['user_id', 'full_name', 'phone'],
    properties: {
      user_id: { bsonType: 'objectId', description: 'must be an objectId and is required' },
      full_name: { bsonType: 'string', description: 'must be a string and is required' },
      phone: { bsonType: 'string', description: 'must be a string and is required' },
    },
  },
};

const guardianSchema = new Schema<IGuardian>(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
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

export const Guardian: Model<IGuardian> =
  mongoose.models.Guardian || mongoose.model<IGuardian>('Guardian', guardianSchema, 'guardians');


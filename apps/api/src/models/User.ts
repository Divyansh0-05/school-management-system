import mongoose, { Schema, Document, Model } from 'mongoose';
import { UserRole } from '@school/shared';

export interface IUser extends Document {
  email: string;
  password_hash: string;
  role: UserRole;
  is_active: boolean;
  failed_logins: number;
  locked_until: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const UserJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['email', 'password_hash', 'role'],
    properties: {
      email: {
        bsonType: 'string',
        pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$',
        description: 'must be a valid email address and is required',
      },
      password_hash: {
        bsonType: 'string',
        description: 'must be a string and is required',
      },
      role: {
        enum: [UserRole.ADMIN, UserRole.TEACHER, UserRole.GUARDIAN],
        description: 'must be one of the permitted user roles',
      },
      is_active: {
        bsonType: 'bool',
        description: 'indicates whether user is active',
      },
      failed_logins: {
        bsonType: 'int',
        minimum: 0,
        description: 'count of failed login attempts',
      },
      locked_until: {
        bsonType: ['date', 'null'],
        description: 'timestamp until which account is locked',
      },
    },
  },
};

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password_hash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      required: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    failed_logins: {
      type: Number,
      default: 0,
      min: 0,
    },
    locked_until: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', userSchema, 'users');


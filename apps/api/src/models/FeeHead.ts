import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFeeHead extends Document {
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export const FeeHeadJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['name'],
    properties: {
      name: { bsonType: 'string', description: 'must be a string and is required' },
    },
  },
};

const feeHeadSchema = new Schema<IFeeHead>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
  },
  { timestamps: true }
);

export const FeeHead: Model<IFeeHead> =
  mongoose.models.FeeHead || mongoose.model<IFeeHead>('FeeHead', feeHeadSchema, 'fee_heads');


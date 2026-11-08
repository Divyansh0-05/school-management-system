import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { PaymentMethod, PaymentStatus } from '@school/shared';

export interface IPayment extends Document {
  invoice_id: Types.ObjectId;
  amount_paise: number; // Integer paise
  method: PaymentMethod;
  status: PaymentStatus;
  idempotency_key: string;
  request_hash: string;
  receipt_no: string;
  paid_by_user_id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export const PaymentJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'invoice_id',
      'amount_paise',
      'method',
      'status',
      'idempotency_key',
      'request_hash',
      'receipt_no',
      'paid_by_user_id',
    ],
    properties: {
      invoice_id: { bsonType: 'objectId' },
      amount_paise: { bsonType: 'int', minimum: 1, description: 'positive integer paise' },
      method: {
        enum: [PaymentMethod.SIMULATED_CARD, PaymentMethod.SIMULATED_UPI, PaymentMethod.CASH],
      },
      status: {
        enum: [PaymentStatus.SUCCEEDED, PaymentStatus.FAILED],
      },
      idempotency_key: { bsonType: 'string' },
      request_hash: { bsonType: 'string' },
      receipt_no: { bsonType: 'string' },
      paid_by_user_id: { bsonType: 'objectId' },
    },
  },
};

const paymentSchema = new Schema<IPayment>(
  {
    invoice_id: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
      index: true,
    },
    amount_paise: {
      type: Number,
      required: true,
      min: 1,
    },
    method: {
      type: String,
      enum: Object.values(PaymentMethod),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      required: true,
    },
    idempotency_key: {
      type: String,
      required: true,
    },
    request_hash: {
      type: String,
      required: true,
    },
    receipt_no: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    paid_by_user_id: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Idempotency constraint per payer
paymentSchema.index({ paid_by_user_id: 1, idempotency_key: 1 }, { unique: true });

// Query index
paymentSchema.index({ invoice_id: 1, status: 1 });

export const Payment: Model<IPayment> =
  mongoose.models.Payment || mongoose.model<IPayment>('Payment', paymentSchema, 'payments');


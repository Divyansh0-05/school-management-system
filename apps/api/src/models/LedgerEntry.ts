import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { LedgerEntryType } from '@school/shared';

export interface ILedgerEntry extends Document {
  student_id: Types.ObjectId;
  invoice_id: Types.ObjectId;
  payment_id: Types.ObjectId | null;
  type: LedgerEntryType;
  amount_paise: number; // Signed integer (+charge / -credit)
  created_by: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export const LedgerEntryJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['student_id', 'invoice_id', 'type', 'amount_paise', 'created_by'],
    properties: {
      student_id: { bsonType: 'objectId' },
      invoice_id: { bsonType: 'objectId' },
      payment_id: { bsonType: ['objectId', 'null'] },
      type: {
        enum: [
          LedgerEntryType.INVOICE_ISSUED,
          LedgerEntryType.PAYMENT,
          LedgerEntryType.REVERSAL,
          LedgerEntryType.INVOICE_VOID,
        ],
      },
      amount_paise: {
        bsonType: 'int',
        description: 'signed integer paise (+charge, -credit)',
      },
      created_by: { bsonType: 'objectId' },
    },
  },
};

const ledgerEntrySchema = new Schema<ILedgerEntry>(
  {
    student_id: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    invoice_id: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
      index: true,
    },
    payment_id: {
      type: Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
    type: {
      type: String,
      enum: Object.values(LedgerEntryType),
      required: true,
    },
    amount_paise: {
      type: Number,
      required: true,
    },
    created_by: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Prevent updates and deletes at Mongoose schema middleware level (append-only enforcement)
ledgerEntrySchema.pre(
  ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndDelete'],
  function (next) {
    next(new Error('Ledger is immutable: updates and deletions are strictly forbidden'));
  }
);

export const LedgerEntry: Model<ILedgerEntry> =
  mongoose.models.LedgerEntry ||
  mongoose.model<ILedgerEntry>('LedgerEntry', ledgerEntrySchema, 'ledger_entries');


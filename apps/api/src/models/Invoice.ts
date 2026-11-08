import mongoose, { Schema, Document, Model, Types } from 'mongoose';
import { InvoiceStatus } from '@school/shared';

export interface IInvoiceItem {
  fee_head_id: Types.ObjectId;
  description: string;
  amount_paise: number; // Integer paise
}

export interface IInvoice extends Document {
  invoice_no: string;
  student_id: Types.ObjectId;
  academic_year_id: Types.ObjectId;
  period_label: string;
  due_date: Date;
  status: InvoiceStatus;
  total_paise: number; // Integer paise
  issued_at: Date | null;
  voided_at: Date | null;
  void_reason: string | null;
  version: number;
  invoice_items: IInvoiceItem[];
  createdAt: Date;
  updatedAt: Date;
}

export const InvoiceJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: [
      'invoice_no',
      'student_id',
      'academic_year_id',
      'period_label',
      'due_date',
      'status',
      'total_paise',
      'version',
      'invoice_items',
    ],
    properties: {
      invoice_no: { bsonType: 'string', description: 'unique invoice identifier' },
      student_id: { bsonType: 'objectId', description: 'must be an objectId' },
      academic_year_id: { bsonType: 'objectId', description: 'must be an objectId' },
      period_label: { bsonType: 'string', description: 'billing period label' },
      due_date: { bsonType: 'date', description: 'invoice due date' },
      status: {
        enum: [
          InvoiceStatus.DRAFT,
          InvoiceStatus.ISSUED,
          InvoiceStatus.PARTIALLY_PAID,
          InvoiceStatus.PAID,
          InvoiceStatus.VOID,
        ],
        description: 'valid invoice lifecycle status',
      },
      total_paise: { bsonType: 'int', minimum: 0, description: 'total invoice amount in integer paise' },
      issued_at: { bsonType: ['date', 'null'] },
      voided_at: { bsonType: ['date', 'null'] },
      void_reason: { bsonType: ['string', 'null'] },
      version: { bsonType: 'int', minimum: 0, description: 'optimistic lock concurrency version' },
      invoice_items: {
        bsonType: 'array',
        items: {
          bsonType: 'object',
          required: ['fee_head_id', 'description', 'amount_paise'],
          properties: {
            fee_head_id: { bsonType: 'objectId' },
            description: { bsonType: 'string' },
            amount_paise: { bsonType: 'int', minimum: 1, description: 'must be positive integer paise' },
          },
        },
      },
    },
  },
};

const invoiceItemSchema = new Schema<IInvoiceItem>(
  {
    fee_head_id: {
      type: Schema.Types.ObjectId,
      ref: 'FeeHead',
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    amount_paise: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  { _id: false }
);

const invoiceSchema = new Schema<IInvoice>(
  {
    invoice_no: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    student_id: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    academic_year_id: {
      type: Schema.Types.ObjectId,
      ref: 'AcademicYear',
      required: true,
      index: true,
    },
    period_label: {
      type: String,
      required: true,
      trim: true,
    },
    due_date: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(InvoiceStatus),
      default: InvoiceStatus.DRAFT,
      index: true,
    },
    total_paise: {
      type: Number,
      required: true,
      min: 0,
    },
    issued_at: {
      type: Date,
      default: null,
    },
    voided_at: {
      type: Date,
      default: null,
    },
    void_reason: {
      type: String,
      default: null,
    },
    version: {
      type: Number,
      default: 0,
    },
    invoice_items: {
      type: [invoiceItemSchema],
      required: true,
    },
  },
  { timestamps: true }
);

// Unique invoice per student per period
invoiceSchema.index({ student_id: 1, period_label: 1 }, { unique: true });

// Status query index
invoiceSchema.index({ student_id: 1, status: 1 });

export const Invoice: Model<IInvoice> =
  mongoose.models.Invoice || mongoose.model<IInvoice>('Invoice', invoiceSchema, 'invoices');


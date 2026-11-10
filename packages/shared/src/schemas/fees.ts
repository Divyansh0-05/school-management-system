import { z } from 'zod';
import { InvoiceStatus, PaymentMethod, PaymentStatus } from '../constants/status.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const positivePaise = z.number().int().positive();
const page = z.coerce.number().int().min(1).default(1);
const pageSize = z.coerce.number().int().min(1).max(100).default(20);

export const InvoiceItemSchema = z.object({
  feeHeadId: objectId,
  description: z.string().trim().min(1).max(200),
  amountPaise: positivePaise,
});
export const InvoiceCreateSchema = z.object({
  studentId: objectId,
  academicYearId: objectId,
  periodLabel: z.string().trim().min(1).max(100),
  dueDate: z.coerce.date(),
  items: z.array(InvoiceItemSchema).min(1),
});
export const InvoiceUpdateSchema = InvoiceCreateSchema.partial();
export const InvoiceQuerySchema = z.object({
  page, pageSize, studentId: objectId.optional(), status: z.nativeEnum(InvoiceStatus).optional(),
  periodLabel: z.string().optional(), overdue: z.coerce.boolean().optional(),
});
export const PaymentCreateSchema = z.object({
  amountPaise: positivePaise,
  method: z.nativeEnum(PaymentMethod),
  simulatedStatus: z.nativeEnum(PaymentStatus).default(PaymentStatus.SUCCEEDED),
});
export const PaymentQuerySchema = z.object({ page, pageSize, studentId: objectId.optional(), invoiceId: objectId.optional(), status: z.nativeEnum(PaymentStatus).optional() });
export const FeeIdParamsSchema = z.object({ id: objectId });
export const StudentLedgerQuerySchema = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() });
export const GenerateInvoiceSchema = z.object({ sectionId: objectId, academicYearId: objectId, periodLabel: z.string().trim().min(1).max(100), dueDate: z.coerce.date(), items: z.array(InvoiceItemSchema).min(1) });
export const FeeSummaryQuerySchema = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional(), academicYearId: objectId.optional() });
export type InvoiceCreate = z.infer<typeof InvoiceCreateSchema>;
export type InvoiceUpdate = z.infer<typeof InvoiceUpdateSchema>;
export type PaymentCreate = z.infer<typeof PaymentCreateSchema>;

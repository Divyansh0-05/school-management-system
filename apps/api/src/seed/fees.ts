import { Invoice, FeeHead, Payment, LedgerEntry } from '../models/index.js';
import { InvoiceStatus, LedgerEntryType, PaymentMethod, PaymentStatus } from '@school/shared';
import type { SeededAcademics } from './academics.js';
import type { IStudent } from '../models/Student.js';
import type { Types } from 'mongoose';

export async function seedFees(academics: SeededAcademics, students: IStudent[], adminUserId: Types.ObjectId) {
  const head = await FeeHead.findOneAndUpdate(
    { name: 'Tuition' },
    { name: 'Tuition' },
    { upsert: true, new: true }
  );
  const definitions = [
    { status: InvoiceStatus.DRAFT, period: 'DEMO-DRAFT', amount: 10000 },
    { status: InvoiceStatus.ISSUED, period: 'DEMO-ISSUED', amount: 12000 },
    { status: InvoiceStatus.PARTIALLY_PAID, period: 'DEMO-PARTIAL', amount: 15000 },
    { status: InvoiceStatus.PAID, period: 'DEMO-PAID', amount: 18000 },
    { status: InvoiceStatus.VOID, period: 'DEMO-VOID', amount: 9000 },
  ];
  for (let index = 0; index < definitions.length; index += 1) {
    const definition = definitions[index];
    const student = students[index % students.length];
    const invoice = await Invoice.findOneAndUpdate(
      { invoice_no: `INV-2026-DEMO-${index + 1}` },
      {
        invoice_no: `INV-2026-DEMO-${index + 1}`,
        student_id: student._id,
        academic_year_id: academics.academicYear._id,
        period_label: definition.period,
        due_date: new Date('2026-06-01T00:00:00.000Z'),
        status: definition.status,
        total_paise: definition.amount,
        version: 0,
        issued_at: definition.status === InvoiceStatus.DRAFT ? null : new Date('2026-04-05T00:00:00.000Z'),
        voided_at: definition.status === InvoiceStatus.VOID ? new Date('2026-04-06T00:00:00.000Z') : null,
        void_reason: definition.status === InvoiceStatus.VOID ? 'Demo seed' : null,
        invoice_items: [{ fee_head_id: head._id, description: 'Tuition', amount_paise: definition.amount }],
      },
      { upsert: true, new: true }
    );
    if (definition.status === InvoiceStatus.DRAFT) continue;
    const hasLedger = await LedgerEntry.exists({ invoice_id: invoice._id });
    if (hasLedger) continue;
    await LedgerEntry.create({
      student_id: student._id, invoice_id: invoice._id, payment_id: null,
      type: LedgerEntryType.INVOICE_ISSUED, amount_paise: definition.amount, created_by: adminUserId,
    });
    if (definition.status === InvoiceStatus.PARTIALLY_PAID || definition.status === InvoiceStatus.PAID) {
      const paid = definition.status === InvoiceStatus.PARTIALLY_PAID ? 5000 : definition.amount;
      const payment = await Payment.findOneAndUpdate(
        { receipt_no: `RCP-2026-DEMO-${index + 1}` },
        {
          invoice_id: invoice._id,
          amount_paise: paid,
          method: PaymentMethod.SIMULATED_CARD,
          status: PaymentStatus.SUCCEEDED,
          idempotency_key: `demo-${index + 1}`,
          request_hash: `demo-${index + 1}`,
          receipt_no: `RCP-2026-DEMO-${index + 1}`,
          paid_by_user_id: adminUserId,
        },
        { upsert: true, new: true }
      );
      await LedgerEntry.create({
        student_id: student._id,
        invoice_id: invoice._id,
        payment_id: payment._id,
        type: LedgerEntryType.PAYMENT,
        amount_paise: -paid,
        created_by: adminUserId,
      });
    }
    if (definition.status === InvoiceStatus.VOID) {
      await LedgerEntry.create({
        student_id: student._id,
        invoice_id: invoice._id,
        payment_id: null,
        type: LedgerEntryType.INVOICE_VOID,
        amount_paise: -definition.amount,
        created_by: adminUserId,
      });
    }
  }
}

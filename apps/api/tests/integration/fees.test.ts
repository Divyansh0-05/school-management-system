import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Types } from 'mongoose';
import { app } from '../../src/app.js';
import { seed } from '../../src/seed/index.js';
import { setupTestDb, teardownTestDb } from '../helpers/testDb.js';
import { env } from '../../src/config/env.js';
import { AcademicYear, AuditLog, Enrollment, FeeHead, Invoice, LedgerEntry, Payment, Student, StudentGuardian } from '../../src/models/index.js';
import { auditService } from '../../src/audit/audit.service.js';
import { InvoiceStatus, LedgerEntryType } from '@school/shared';

type Cookie = string[];
type InvoiceDoc = { _id: Types.ObjectId; student_id: Types.ObjectId; total_paise: number; status: string; invoice_no: string };

describe('fees API integration', () => {
  let admin: Cookie;
  let teacher: Cookie;
  let guardian1: Cookie;
  let academicYearId: string;
  let feeHeadId: string;
  let student1Id: string;
  let student2Id: string;
  let otherFamilyStudentId: string;
  let sectionId: string;
  let studentsForParallel: string[] = [];

  const login = async (email: string) => (await request(app).post('/api/v1/auth/login').send({ email, password: 'Demo@12345' })).headers['set-cookie'] as Cookie;
  const createInvoice = async (cookie: Cookie, studentId = student1Id, amountPaise = 10000, period = `TEST-${Date.now()}-${Math.random()}`) => {
    const response = await request(app).post('/api/v1/invoices').set('Cookie', cookie).send({
      studentId, academicYearId, periodLabel: period, dueDate: '2027-01-01T00:00:00.000Z',
      items: [{ feeHeadId, description: 'Tuition', amountPaise }],
    });
    expect(response.status).toBe(201);
    return response.body.data as InvoiceDoc;
  };
  const issue = async (cookie: Cookie, invoiceId: string) => request(app).post(`/api/v1/invoices/${invoiceId}/issue`).set('Cookie', cookie).send({});
  const ledger = async (invoiceId: string) => LedgerEntry.find({ invoice_id: invoiceId }).lean();
  const totalLedger = async (invoiceId: string) => (await ledger(invoiceId)).reduce((sum, entry) => sum + entry.amount_paise, 0);
  const paymentBody = (amountPaise: number, simulatedStatus = 'SUCCEEDED') => ({ amountPaise, method: 'SIMULATED_CARD', simulatedStatus });

  beforeAll(async () => {
    await setupTestDb();
    await seed(env.MONGODB_TEST_URI);
    admin = await login('admin@school.demo');
    teacher = await login('teacher1@school.demo');
    guardian1 = await login('guardian1@school.demo');
    academicYearId = (await AcademicYear.findOne({ is_current: true }).lean())!._id.toString();
    feeHeadId = (await FeeHead.findOne({ name: 'Tuition' }).lean())!._id.toString();
    const students = await Student.find().sort({ admission_no: 1 }).lean();
    studentsForParallel = students.slice(0, 10).map((student) => student._id.toString());
    student1Id = students[0]._id.toString();
    student2Id = students[1]._id.toString();
    const linked = await StudentGuardian.findOne({ guardian_id: { $ne: (await StudentGuardian.findOne({ student_id: student1Id }))?.guardian_id }, student_id: { $nin: [student1Id, student2Id] } }).lean();
    otherFamilyStudentId = linked!.student_id.toString();
    sectionId = (await Enrollment.findOne({ student_id: student1Id, academic_year_id: academicYearId }).lean())!.section_id.toString();
  }, 120000);

  afterAll(async () => teardownTestDb());

  it('A5 issue and payments keep per-invoice and per-student ledgers reconciled', async () => {
    const seededReconciliation = await request(app).get('/api/v1/reports/fees/reconciliation').set('Cookie', admin);
    expect(seededReconciliation.body.data.mismatches).toEqual([]);
    const invoice = await createInvoice(admin, student1Id, 10000);
    const assertBalances = async (expectedOutstanding: number) => {
      const current = (await Invoice.findById(invoice._id).lean())!;
      const invoiceEntries = await ledger(invoice._id.toString());
      const successfulPaid = (await Payment.find({ invoice_id: invoice._id, status: 'SUCCEEDED' }).lean()).reduce((sum, payment) => sum + payment.amount_paise, 0);
      expect(current.total_paise - successfulPaid).toBe(expectedOutstanding);
      expect(invoiceEntries.reduce((sum, entry) => sum + entry.amount_paise, 0)).toBe(expectedOutstanding);
      const studentInvoices = await Invoice.find({ student_id: invoice.student_id }).lean();
      const studentEntries = await LedgerEntry.find({ student_id: invoice.student_id }).lean();
      const expectedStudentLedger = studentInvoices.reduce((sum, item) => sum + (item.status === InvoiceStatus.DRAFT ? 0 : item.status === InvoiceStatus.VOID ? 0 : item.total_paise), 0)
        - (await Payment.find({ invoice_id: { $in: studentInvoices.map((item) => item._id) }, status: 'SUCCEEDED' }).lean()).reduce((sum, payment) => sum + payment.amount_paise, 0);
      expect(studentEntries.reduce((sum, entry) => sum + entry.amount_paise, 0)).toBe(expectedStudentLedger);
    };
    expect((await issue(admin, invoice._id.toString())).status).toBe(200);
    expect((await Invoice.findById(invoice._id).lean())!.status).toBe(InvoiceStatus.ISSUED);
    await assertBalances(10000);
    const partial = await request(app).post(`/api/v1/invoices/${invoice._id}/payments`).set('Cookie', admin).set('Idempotency-Key', `partial-${invoice._id}`).send(paymentBody(4000));
    expect(partial.status).toBe(201);
    expect((await Invoice.findById(invoice._id).lean())!.status).toBe(InvoiceStatus.PARTIALLY_PAID);
    await assertBalances(6000);
    const complete = await request(app).post(`/api/v1/invoices/${invoice._id}/payments`).set('Cookie', admin).set('Idempotency-Key', `complete-${invoice._id}`).send(paymentBody(6000));
    expect(complete.status).toBe(201);
    expect((await Invoice.findById(invoice._id).lean())!.status).toBe(InvoiceStatus.PAID);
    await assertBalances(0);
    const reconciliation = await request(app).get('/api/v1/reports/fees/reconciliation').set('Cookie', admin);
    expect(reconciliation.status).toBe(200);
    expect(reconciliation.body.data.mismatches).toEqual([]);
  });

  it('rejects overpayment and payments on DRAFT, VOID, and PAID invoices without writes', async () => {
    const draft = await createInvoice(admin);
    const draftAttempt = await request(app).post(`/api/v1/invoices/${draft._id}/payments`).set('Cookie', admin).set('Idempotency-Key', `draft-${draft._id}`).send(paymentBody(1));
    expect(draftAttempt.status).toBe(409);
    const issued = await createInvoice(admin, student2Id, 5000);
    await issue(admin, issued._id.toString());
    const beforePayments = await Payment.countDocuments({ invoice_id: issued._id });
    const overpayment = await request(app).post(`/api/v1/invoices/${issued._id}/payments`).set('Cookie', admin).set('Idempotency-Key', `over-${issued._id}`).send(paymentBody(5001));
    expect(overpayment.status).toBe(409);
    expect(overpayment.body.code).toBe('OVERPAYMENT');
    expect(await Payment.countDocuments({ invoice_id: issued._id })).toBe(beforePayments);
    const voided = await createInvoice(admin, student2Id, 5000);
    expect((await request(app).post(`/api/v1/invoices/${voided._id}/void`).set('Cookie', admin).send({})).status).toBe(200);
    const voidAttempt = await request(app).post(`/api/v1/invoices/${voided._id}/payments`).set('Cookie', admin).set('Idempotency-Key', `void-${voided._id}`).send(paymentBody(1));
    expect(voidAttempt.status).toBe(409);
    const paid = await createInvoice(admin, student2Id, 5000);
    await issue(admin, paid._id.toString());
    await request(app).post(`/api/v1/invoices/${paid._id}/payments`).set('Cookie', admin).set('Idempotency-Key', `paid-${paid._id}`).send(paymentBody(5000));
    const paidAttempt = await request(app).post(`/api/v1/invoices/${paid._id}/payments`).set('Cookie', admin).set('Idempotency-Key', `paid-again-${paid._id}`).send(paymentBody(1));
    expect(paidAttempt.status).toBe(409);
  });

  it('replays idempotent payments, rejects key reuse, and requires the key', async () => {
    const invoice = await createInvoice(admin, student1Id, 9000);
    await issue(admin, invoice._id.toString());
    const body = paymentBody(3000);
    const replayKey = `fee-replay-${invoice._id}`;
    const first = await request(app).post(`/api/v1/invoices/${invoice._id}/payments`).set('Cookie', admin).set('Idempotency-Key', replayKey).send(body);
    const replay = await request(app).post(`/api/v1/invoices/${invoice._id}/payments`).set('Cookie', admin).set('Idempotency-Key', replayKey).send(body);
    expect(first.status).toBe(201);
    expect(replay.status).toBe(200);
    expect(replay.headers['idempotent-replay']).toBe('true');
    expect(replay.body.data.payment._id).toBe(first.body.data.payment._id);
    expect(await Payment.countDocuments({ invoice_id: invoice._id })).toBe(1);
    expect(await LedgerEntry.countDocuments({ invoice_id: invoice._id, type: LedgerEntryType.PAYMENT })).toBe(1);
    const reused = await request(app).post(`/api/v1/invoices/${invoice._id}/payments`).set('Cookie', admin).set('Idempotency-Key', replayKey).send(paymentBody(3001));
    expect(reused.status).toBe(422);
    expect(reused.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
    const missing = await request(app).post(`/api/v1/invoices/${invoice._id}/payments`).set('Cookie', admin).send(body);
    expect(missing.status).toBe(422);
  });

  it('handles concurrent payments and concurrent counter allocation', async () => {
    const invoice = await createInvoice(admin, student1Id, 8000);
    await issue(admin, invoice._id.toString());
    const results = await Promise.all([
      request(app).post(`/api/v1/invoices/${invoice._id}/payments`).set('Cookie', admin).set('Idempotency-Key', `race-a-${invoice._id}`).send(paymentBody(8000)),
      request(app).post(`/api/v1/invoices/${invoice._id}/payments`).set('Cookie', admin).set('Idempotency-Key', `race-b-${invoice._id}`).send(paymentBody(8000)),
    ]);
    expect(results.filter((result) => result.status === 201)).toHaveLength(1);
    expect(results.filter((result) => result.status === 409)).toHaveLength(1);
    expect(await Payment.countDocuments({ invoice_id: invoice._id, status: 'SUCCEEDED' })).toBe(1);
    expect(await LedgerEntry.countDocuments({ invoice_id: invoice._id, type: LedgerEntryType.PAYMENT })).toBe(1);
    expect(await totalLedger(invoice._id.toString())).toBe(0);

    const sameKeyInvoice = await createInvoice(admin, student2Id, 7000);
    await issue(admin, sameKeyInvoice._id.toString());
    const repeated = await Promise.all(Array.from({ length: 20 }, () => request(app).post(`/api/v1/invoices/${sameKeyInvoice._id}/payments`).set('Cookie', admin).set('Idempotency-Key', `parallel-same-key-${sameKeyInvoice._id}`).send(paymentBody(7000))));
    expect(await Payment.countDocuments({ invoice_id: sameKeyInvoice._id })).toBe(1);
    expect(repeated.some((result) => result.status === 201 || result.status === 200)).toBe(true);

    const created = await Promise.all(Array.from({ length: 10 }, (_, index) => createInvoice(admin, studentsForParallel[index % studentsForParallel.length], 1000, `parallel-invoice-${Date.now()}-${index}`)));
    expect(new Set(created.map((item) => item.invoice_no)).size).toBe(10);
  });

  it('records failed payments without ledger changes and permits a later success', async () => {
    const invoice = await createInvoice(admin, student1Id, 6000);
    await issue(admin, invoice._id.toString());
    const failed = await request(app).post(`/api/v1/invoices/${invoice._id}/payments`).set('Cookie', admin).set('Idempotency-Key', `failed-${invoice._id}`).send(paymentBody(2000, 'FAILED'));
    expect(failed.status).toBe(201);
    expect(await Payment.countDocuments({ invoice_id: invoice._id, status: 'FAILED' })).toBe(1);
    expect(await LedgerEntry.countDocuments({ invoice_id: invoice._id })).toBe(1);
    expect(await totalLedger(invoice._id.toString())).toBe(6000);
    const success = await request(app).post(`/api/v1/invoices/${invoice._id}/payments`).set('Cookie', admin).set('Idempotency-Key', `success-after-failed-${invoice._id}`).send(paymentBody(6000));
    expect(success.status).toBe(201);
    expect(await totalLedger(invoice._id.toString())).toBe(0);
  });

  it('voids only permitted invoices and writes the correct ledger entries', async () => {
    const withPayment = await createInvoice(admin, student1Id, 6000);
    await issue(admin, withPayment._id.toString());
    await request(app).post(`/api/v1/invoices/${withPayment._id}/payments`).set('Cookie', admin).set('Idempotency-Key', `void-paid-${withPayment._id}`).send(paymentBody(1000));
    const blocked = await request(app).post(`/api/v1/invoices/${withPayment._id}/void`).set('Cookie', admin).send({});
    expect(blocked.status).toBe(409);
    expect(blocked.body.code).toBe('INVOICE_HAS_PAYMENTS');
    const issued = await createInvoice(admin, student2Id, 6000);
    await issue(admin, issued._id.toString());
    expect((await request(app).post(`/api/v1/invoices/${issued._id}/void`).set('Cookie', admin).send({})).status).toBe(200);
    expect(await LedgerEntry.countDocuments({ invoice_id: issued._id, type: LedgerEntryType.INVOICE_VOID })).toBe(1);
    expect(await totalLedger(issued._id.toString())).toBe(0);
    const draft = await createInvoice(admin, student2Id, 6000);
    expect((await request(app).post(`/api/v1/invoices/${draft._id}/void`).set('Cookie', admin).send({})).status).toBe(200);
    expect(await LedgerEntry.countDocuments({ invoice_id: draft._id })).toBe(0);
    const invalid = await request(app).post(`/api/v1/invoices/${issued._id}/issue`).set('Cookie', admin).send({});
    expect(invalid.status).toBe(409);
  });

  it('enforces guardian and teacher fee scopes', async () => {
    const own = await createInvoice(admin, student1Id, 5000);
    await issue(admin, own._id.toString());
    const ownPayment = await request(app).post(`/api/v1/invoices/${own._id}/payments`).set('Cookie', guardian1).set('Idempotency-Key', `guardian-own-${own._id}`).send(paymentBody(1000));
    expect(ownPayment.status).toBe(201);
    const other = await createInvoice(admin, otherFamilyStudentId, 5000);
    await issue(admin, other._id.toString());
    const forbiddenFamily = await request(app).post(`/api/v1/invoices/${other._id}/payments`).set('Cookie', guardian1).set('Idempotency-Key', `guardian-other-${other._id}`).send(paymentBody(1000));
    expect(forbiddenFamily.status).toBe(404);
    const cash = await request(app).post(`/api/v1/invoices/${own._id}/payments`).set('Cookie', guardian1).set('Idempotency-Key', `guardian-cash-${own._id}`).send({ amountPaise: 1000, method: 'CASH', simulatedStatus: 'SUCCEEDED' });
    expect(cash.status).toBe(403);
    expect((await request(app).get('/api/v1/invoices').set('Cookie', teacher)).status).toBe(403);
    expect((await request(app).get('/api/v1/invoices')).status).toBe(401);
  });

  it('writes audit rows and rolls back payment and ledger when audit fails', async () => {
    const invoice = await createInvoice(admin, student1Id, 5000);
    await issue(admin, invoice._id.toString());
    const issueAudit = await AuditLog.findOne({ entity_type: 'invoice', entity_id: invoice._id.toString(), action: 'ISSUE' }).lean();
    expect(issueAudit).not.toBeNull();
    const spy = vi.spyOn(auditService, 'record').mockRejectedValueOnce(new Error('audit unavailable'));
    const failed = await request(app).post(`/api/v1/invoices/${invoice._id}/payments`).set('Cookie', admin).set('Idempotency-Key', `audit-failure-${invoice._id}`).send(paymentBody(1000));
    spy.mockRestore();
    expect(failed.status).toBe(500);
    expect(await Payment.countDocuments({ invoice_id: invoice._id })).toBe(0);
    expect(await LedgerEntry.countDocuments({ invoice_id: invoice._id, type: LedgerEntryType.PAYMENT })).toBe(0);
    expect(await AuditLog.countDocuments({ entity_type: 'payment', entity_id: { $regex: invoice._id.toString() } })).toBe(0);
  });

  it('generates section invoices once and reports created and skipped counts', async () => {
    const periodLabel = `GENERATE-${Date.now()}`;
    const body = { sectionId, academicYearId, periodLabel, dueDate: '2027-02-01T00:00:00.000Z', items: [{ feeHeadId, description: 'Tuition', amountPaise: 2500 }] };
    const first = await request(app).post('/api/v1/invoices/generate-for-section').set('Cookie', admin).send(body);
    const second = await request(app).post('/api/v1/invoices/generate-for-section').set('Cookie', admin).send(body);
    const expected = await Enrollment.countDocuments({ section_id: sectionId, academic_year_id: academicYearId });
    expect(first.status).toBe(201);
    expect(first.body.data.createdCount).toBe(expected);
    expect(second.status).toBe(201);
    expect(second.body.data.createdCount).toBe(0);
    expect(second.body.data.skippedCount).toBe(expected);
    expect(await Invoice.countDocuments({ period_label: periodLabel })).toBe(expected);
  });
});

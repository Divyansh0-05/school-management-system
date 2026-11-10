import crypto from 'node:crypto';
import { Types } from 'mongoose';
import { InvoiceStatus, LedgerEntryType, PaymentMethod, PaymentStatus, UserRole } from '@school/shared';
import type { AuthTokenPayload } from '../auth/auth.tokens.js';
import type { InvoiceCreate, InvoiceUpdate, PaymentCreate } from '@school/shared';
import { withTransaction } from '../../db/connection.js';
import { recordAuditLog } from '../../audit/audit.service.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../errors/appError.js';
import { feesRepository } from './fees.repository.js';

const oid = (id: string) => new Types.ObjectId(id);
export interface FeeQuery {
  page: number;
  pageSize: number;
  studentId?: string;
  invoiceId?: string;
  status?: PaymentStatus | InvoiceStatus;
  periodLabel?: string;
}
interface FeeItemInput {
  feeHeadId?: string;
  fee_head_id?: Types.ObjectId;
  description: string;
  amountPaise?: number;
  amount_paise?: number;
}
interface InvoiceSnapshot {
  invoice_items?: FeeItemInput[];
}
const auditState = (value: object): Record<string, unknown> => Object.fromEntries(Object.entries(value));
interface FeePaymentResult {
  payment?: unknown;
  invoice?: unknown;
  idempotentReplay: boolean;
  [key: string]: unknown;
}
export const feeRequestHash = (invoiceId: string, body: PaymentCreate) => crypto.createHash('sha256').update(JSON.stringify({ invoiceId, ...body })).digest('hex');
export const ledgerSum = (entries: Array<{ amount_paise: number }>) => entries.reduce((sum, entry) => sum + entry.amount_paise, 0);

export class FeesService {
  private admin(actor: AuthTokenPayload) { if (actor.role !== UserRole.ADMIN) throw new ForbiddenError('Administrator role required', 'ROLE_NOT_PERMITTED'); }
  private async allowed(actor: AuthTokenPayload, invoice: { student_id: Types.ObjectId }) {
    if (actor.role === UserRole.ADMIN) return;
    if (actor.role === UserRole.TEACHER) throw new ForbiddenError('Teachers cannot access fee routes', 'ROLE_NOT_PERMITTED');
    if (!actor.guardianId || !(await feesRepository.linked(actor.guardianId, invoice.student_id.toString()))) throw new NotFoundError('Invoice was not found');
  }
  private async invoiceTotal(input: InvoiceCreate | InvoiceUpdate, fallback?: InvoiceSnapshot) {
    const items = input.items || fallback?.invoice_items;
    if (!items || !Array.isArray(items) || !items.length) throw new ValidationError('Invoice needs at least one item', undefined, 'INVOICE_ITEMS_REQUIRED');
    const normalized = items.map((item: FeeItemInput) => {
      const amountPaise = item.amountPaise ?? item.amount_paise;
      if (typeof amountPaise !== 'number' || !Number.isInteger(amountPaise) || amountPaise <= 0) throw new ValidationError('Invoice amounts must be positive integer paise');
      return { fee_head_id: oid(String(item.feeHeadId || item.fee_head_id)), description: item.description, amount_paise: amountPaise };
    });
    return { invoice_items: normalized, total_paise: normalized.reduce((sum, item) => sum + item.amount_paise, 0) };
  }
  async list(actor: AuthTokenPayload, query: FeeQuery) {
    if (actor.role === UserRole.TEACHER) throw new ForbiddenError('Teachers cannot access fee routes', 'ROLE_NOT_PERMITTED');
    const filter: Record<string, unknown> = {};
    if (query.studentId) filter.student_id = query.studentId;
    if (query.status) filter.status = query.status;
    if (query.periodLabel) filter.period_label = query.periodLabel;
    if (actor.role === UserRole.GUARDIAN) {
      const ids = await import('../../models/StudentGuardian.js').then(({ StudentGuardian }) => StudentGuardian.find({ guardian_id: actor.guardianId }).distinct('student_id'));
      filter.student_id = { $in: ids };
    }
    const [data, total] = await feesRepository.invoices(filter, query.page, query.pageSize);
    return { data, meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) || 1 } };
  }
  async get(actor: AuthTokenPayload, id: string) { const invoice = await feesRepository.invoice(id); if (!invoice) throw new NotFoundError('Invoice was not found'); await this.allowed(actor, invoice); return invoice; }
  async create(actor: AuthTokenPayload, input: InvoiceCreate, requestId: string, ip: string) {
    this.admin(actor);
    return withTransaction(async (session) => {
      const total = await this.invoiceTotal(input);
      const year = new Date(input.dueDate).getFullYear();
      const number = await feesRepository.next(`invoice:${year}`, session);
      const created = await feesRepository.createInvoice({ invoice_no: `INV-${year}-${String(number).padStart(6, '0')}`, student_id: oid(input.studentId), academic_year_id: oid(input.academicYearId), period_label: input.periodLabel, due_date: input.dueDate, status: InvoiceStatus.DRAFT, version: 0, issued_at: null, voided_at: null, void_reason: null, ...total }, session);
      await recordAuditLog({ actor, action: 'CREATE', entityType: 'invoice', entityId: String(created._id), after: auditState(created), requestId, ip, session }); return created;
    });
  }
  async update(actor: AuthTokenPayload, id: string, input: InvoiceUpdate, requestId: string, ip: string) { this.admin(actor); return withTransaction(async (session) => { const before = await feesRepository.invoice(id, session); if (!before) throw new NotFoundError('Invoice was not found'); if (before.status !== InvoiceStatus.DRAFT) throw new ConflictError('Only DRAFT invoices can be edited', 'INVALID_STATE_TRANSITION'); const total = await this.invoiceTotal(input, before); const after = await feesRepository.updateInvoice(id, { ...input.studentId && { student_id: oid(input.studentId) }, ...input.academicYearId && { academic_year_id: oid(input.academicYearId) }, ...input.periodLabel && { period_label: input.periodLabel }, ...input.dueDate && { due_date: input.dueDate }, ...total }, session); await recordAuditLog({ actor, action: 'UPDATE', entityType: 'invoice', entityId: id, before: auditState(before), after: after ? auditState(after) : null, requestId, ip, session }); return after; }); }
  async issue(actor: AuthTokenPayload, id: string, requestId: string, ip: string) { this.admin(actor); return withTransaction(async (session) => { const invoice = await feesRepository.invoice(id, session); if (!invoice) throw new NotFoundError('Invoice was not found'); if (invoice.status !== InvoiceStatus.DRAFT) throw new ConflictError('Invalid invoice state transition', 'INVALID_STATE_TRANSITION'); if (!invoice.invoice_items.length) throw new ConflictError('Invoice needs at least one item', 'INVOICE_ITEMS_REQUIRED'); const after = await feesRepository.setInvoice(id, { status: InvoiceStatus.ISSUED, issued_at: new Date() }, session); await feesRepository.createLedger({ student_id: invoice.student_id, invoice_id: invoice._id, payment_id: null, type: LedgerEntryType.INVOICE_ISSUED, amount_paise: invoice.total_paise, created_by: oid(actor.sub) }, session); await recordAuditLog({ actor, action: 'ISSUE', entityType: 'invoice', entityId: id, before: auditState(invoice), after: after ? auditState(after) : null, requestId, ip, session }); return after; }); }
  async void(actor: AuthTokenPayload, id: string, reason: string | undefined, requestId: string, ip: string) { this.admin(actor); return withTransaction(async (session) => { const invoice = await feesRepository.invoice(id, session); if (!invoice) throw new NotFoundError('Invoice was not found'); if (!([InvoiceStatus.DRAFT, InvoiceStatus.ISSUED] as string[]).includes(invoice.status)) throw new ConflictError('Invoice has payments', 'INVOICE_HAS_PAYMENTS'); const entries = await feesRepository.ledger({ invoice_id: id }, session); if (entries.some((entry) => entry.type === LedgerEntryType.PAYMENT)) throw new ConflictError('Invoice has payments', 'INVOICE_HAS_PAYMENTS'); const after = await feesRepository.setInvoice(id, { status: InvoiceStatus.VOID, voided_at: new Date(), void_reason: reason || null }, session); if (invoice.status === InvoiceStatus.ISSUED) await feesRepository.createLedger({ student_id: invoice.student_id, invoice_id: invoice._id, payment_id: null, type: LedgerEntryType.INVOICE_VOID, amount_paise: -invoice.total_paise, created_by: oid(actor.sub) }, session); await recordAuditLog({ actor, action: 'VOID', entityType: 'invoice', entityId: id, before: auditState(invoice), after: after ? auditState(after) : null, requestId, ip, session }); return after; }); }
  async pay(actor: AuthTokenPayload, id: string, body: PaymentCreate, key: string | undefined, requestId: string, ip: string): Promise<FeePaymentResult> {
    if (actor.role === UserRole.TEACHER) throw new ForbiddenError('Teachers cannot access fee routes', 'ROLE_NOT_PERMITTED'); if (!key) throw new ValidationError('Idempotency-Key header is required', undefined, 'IDEMPOTENCY_KEY_REQUIRED'); if (actor.role === UserRole.GUARDIAN && body.method === PaymentMethod.CASH) throw new ForbiddenError('Guardians cannot use CASH', 'ROLE_NOT_PERMITTED'); if (body.simulatedStatus === PaymentStatus.FAILED && body.method === PaymentMethod.CASH) throw new ValidationError('CASH payments cannot be simulated as failed');
    const hash = feeRequestHash(id, body);
    return withTransaction(async (session) => {
      const prior = await feesRepository.paymentByKey(actor.sub, key, session); if (prior) { if (prior.request_hash !== hash) throw new ValidationError('Idempotency key was reused with a different request', undefined, 'IDEMPOTENCY_KEY_REUSED'); return { payment: prior, invoice: await feesRepository.invoice(id, session), idempotentReplay: true }; }
      const invoice = await feesRepository.lockInvoice(id, session); if (!invoice) { const existing = await feesRepository.invoice(id, session); if (!existing) throw new NotFoundError('Invoice was not found'); await this.allowed(actor, existing); throw new ConflictError('Invoice cannot accept payments', 'INVALID_STATE_TRANSITION'); } await this.allowed(actor, invoice);
      const entries = await feesRepository.ledger({ invoice_id: id }, session); const outstanding = ledgerSum(entries); if (body.amountPaise > outstanding) throw new ConflictError('Payment exceeds outstanding balance', 'OVERPAYMENT');
      const year = new Date().getFullYear(); const receipt = await feesRepository.next(`receipt:${year}`, session); const payment = await feesRepository.createPayment({ invoice_id: invoice._id, amount_paise: body.amountPaise, method: body.method, status: body.simulatedStatus, idempotency_key: key, request_hash: hash, receipt_no: `RCP-${year}-${String(receipt).padStart(6, '0')}`, paid_by_user_id: oid(actor.sub) }, session);
      let after = invoice; if (body.simulatedStatus === PaymentStatus.SUCCEEDED) { await feesRepository.createLedger({ student_id: invoice.student_id, invoice_id: invoice._id, payment_id: payment._id, type: LedgerEntryType.PAYMENT, amount_paise: -body.amountPaise, created_by: oid(actor.sub) }, session); const nextOutstanding = outstanding - body.amountPaise; after = await feesRepository.setInvoice(id, { status: nextOutstanding === 0 ? InvoiceStatus.PAID : InvoiceStatus.PARTIALLY_PAID }, session) || invoice; }
      await recordAuditLog({ actor, action: 'PAYMENT', entityType: 'payment', entityId: String(payment._id), after: auditState(payment), requestId, ip, session }); return { payment, invoice: after, idempotentReplay: false };
    });
  }
  async generateForSection(actor: AuthTokenPayload, input: { sectionId: string; academicYearId: string; periodLabel: string; dueDate: Date; items: InvoiceCreate['items'] }, requestId: string, ip: string) {
    this.admin(actor);
    return withTransaction(async (session) => {
      const enrollments = await feesRepository.studentsInSection(input.sectionId, input.academicYearId);
      const studentIds = enrollments.map((entry) => entry.student_id);
      const existing = await feesRepository.existingForStudents(studentIds, input.periodLabel, session);
      const existingIds = new Set(existing.map((entry) => entry.student_id.toString()));
      const total = await this.invoiceTotal(input);
      const year = input.dueDate.getFullYear();
      const created: unknown[] = [];
      for (const studentId of studentIds) {
        if (existingIds.has(studentId.toString())) continue;
        const number = await feesRepository.next(`invoice:${year}`, session);
        const invoice = await feesRepository.createInvoice({
          invoice_no: `INV-${year}-${String(number).padStart(6, '0')}`,
          student_id: studentId,
          academic_year_id: oid(input.academicYearId),
          period_label: input.periodLabel,
          due_date: input.dueDate,
          status: InvoiceStatus.DRAFT,
          version: 0,
          issued_at: null,
          voided_at: null,
          void_reason: null,
          ...total,
        }, session);
        await recordAuditLog({ actor, action: 'CREATE', entityType: 'invoice', entityId: String(invoice._id), after: auditState(invoice), requestId, ip, session });
        created.push(invoice);
      }
      return { created, createdCount: created.length, skippedCount: studentIds.length - created.length };
    });
  }
  async payments(actor: AuthTokenPayload, query: FeeQuery) { if (actor.role === UserRole.TEACHER) throw new ForbiddenError('Teachers cannot access fee routes', 'ROLE_NOT_PERMITTED'); const filter: Record<string, unknown> = {}; if (query.invoiceId) filter.invoice_id = query.invoiceId; if (query.status) filter.status = query.status; if (actor.role === UserRole.GUARDIAN) { const ids = await import('../../models/StudentGuardian.js').then(({ StudentGuardian }) => StudentGuardian.find({ guardian_id: actor.guardianId }).distinct('student_id')); const invoices = await feesRepository.invoices({ student_id: { $in: ids } }, 1, 100000).then(([data]) => data); const scopedInvoiceIds = invoices.map((invoice) => String(invoice._id)); filter.invoice_id = query.invoiceId ? (scopedInvoiceIds.includes(query.invoiceId) ? query.invoiceId : { $in: [] }) : { $in: invoices.map((invoice) => invoice._id) }; } const [data, total] = await feesRepository.payments(filter, query.page, query.pageSize); return { data, meta: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) || 1 } }; }
  async ledger(actor: AuthTokenPayload, studentId: string) { if (actor.role === UserRole.TEACHER) throw new ForbiddenError('Teachers cannot access fee routes', 'ROLE_NOT_PERMITTED'); if (actor.role === UserRole.GUARDIAN && !(await feesRepository.linked(actor.guardianId!, studentId))) throw new NotFoundError('Student was not found'); return feesRepository.ledger({ student_id: studentId }); }
  async summary(actor: AuthTokenPayload) { if (actor.role === UserRole.TEACHER) throw new ForbiddenError('Teachers cannot access fee routes', 'ROLE_NOT_PERMITTED'); const invoices = actor.role === UserRole.ADMIN ? (await feesRepository.invoices({}, 1, 100000))[0] : await feesRepository.invoices({ student_id: { $in: await import('../../models/StudentGuardian.js').then(({ StudentGuardian }) => StudentGuardian.find({ guardian_id: actor.guardianId }).distinct('student_id')) } }, 1, 100000).then(([data]) => data); let billed = 0, collected = 0, overdue = 0; for (const invoice of invoices) { billed += invoice.total_paise; const paid = -ledgerSum(await feesRepository.ledger({ invoice_id: invoice._id })); collected += paid; if (invoice.due_date < new Date() && invoice.total_paise - paid > 0) overdue += invoice.total_paise - paid; } return { billedPaise: billed, collectedPaise: collected, outstandingPaise: billed - collected, overduePaise: overdue }; }
  async reconciliation(actor: AuthTokenPayload) {
    this.admin(actor);
    const invoices = (await feesRepository.invoices({}, 1, 100000))[0];
    const mismatches: unknown[] = [];
    for (const invoice of invoices) {
      const entries = await feesRepository.ledger({ invoice_id: invoice._id });
      const sum = ledgerSum(entries);
      const paid = -entries.filter((entry) => entry.type === LedgerEntryType.PAYMENT).reduce((total, entry) => total + entry.amount_paise, 0);
      const expected = invoice.status === InvoiceStatus.DRAFT || invoice.status === InvoiceStatus.VOID ? 0 : invoice.total_paise - paid;
      const statusConsistent =
        (invoice.status === InvoiceStatus.DRAFT && sum === 0) ||
        (invoice.status === InvoiceStatus.ISSUED && paid === 0 && sum === invoice.total_paise) ||
        (invoice.status === InvoiceStatus.PARTIALLY_PAID && paid > 0 && paid < invoice.total_paise && sum === expected) ||
        (invoice.status === InvoiceStatus.PAID && paid === invoice.total_paise && sum === 0) ||
        (invoice.status === InvoiceStatus.VOID && sum === 0);
      if (sum !== expected || !statusConsistent) mismatches.push({ invoiceId: invoice._id, reason: 'LEDGER_MISMATCH', ledgerSum: sum, expected });
    }
    return { invoices: invoices.length, mismatches };
  }
}
export const feesService = new FeesService();

import { ClientSession } from 'mongoose';
import { Counter, Invoice, LedgerEntry, Payment, StudentGuardian, Enrollment, Student } from '../../models/index.js';

export const feesRepository = {
  invoices: (filter: Record<string, unknown>, page: number, pageSize: number, session?: ClientSession) => Promise.all([
    Invoice.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).session(session || null).lean(),
    Invoice.countDocuments(filter).session(session || null),
  ]),
  invoice: (id: string, session?: ClientSession) => Invoice.findById(id).session(session || null).lean(),
  createInvoice: (data: Record<string, unknown>, session: ClientSession) => Invoice.create([data], { session }).then(([value]) => value.toObject()),
  updateInvoice: (id: string, data: Record<string, unknown>, session: ClientSession) => Invoice.findOneAndUpdate({ _id: id, status: 'DRAFT' }, { $set: data }, { new: true, session, runValidators: true }).lean(),
  lockInvoice: (id: string, session: ClientSession) => Invoice.findOneAndUpdate({ _id: id, status: { $in: ['ISSUED', 'PARTIALLY_PAID'] } }, { $inc: { version: 1 } }, { new: true, session }).lean(),
  setInvoice: (id: string, data: Record<string, unknown>, session: ClientSession) => Invoice.findByIdAndUpdate(id, { $set: data }, { new: true, session }).lean(),
  next: async (key: string, session: ClientSession) => (await Counter.findOneAndUpdate({ key }, { $inc: { value: 1 } }, { upsert: true, new: true, session })).value,
  payments: (filter: Record<string, unknown>, page: number, pageSize: number) => Promise.all([Payment.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(), Payment.countDocuments(filter)]),
  paymentByKey: (userId: string, key: string, session?: ClientSession) => Payment.findOne({ paid_by_user_id: userId, idempotency_key: key }).session(session || null).lean(),
  createPayment: (data: Record<string, unknown>, session: ClientSession) => Payment.create([data], { session }).then(([value]) => value.toObject()),
  ledger: (filter: Record<string, unknown>, session?: ClientSession) => LedgerEntry.find(filter).sort({ createdAt: 1 }).session(session || null).lean(),
  createLedger: (data: Record<string, unknown>, session: ClientSession) => LedgerEntry.create([data], { session }).then(([value]) => value.toObject()),
  linked: (guardianId: string, studentId: string) => StudentGuardian.exists({ guardian_id: guardianId, student_id: studentId }),
  student: (id: string) => Student.findById(id).lean(),
  studentsInSection: (sectionId: string, yearId: string) => Enrollment.find({ section_id: sectionId, academic_year_id: yearId }).select('student_id').lean(),
  existingForStudents: (studentIds: unknown[], periodLabel: string, session?: ClientSession) =>
    Invoice.find({ student_id: { $in: studentIds }, period_label: periodLabel }).session(session || null).select('student_id').lean(),
  invoicesForStudent: (studentId: string) => Invoice.find({ student_id: studentId }).lean(),
};

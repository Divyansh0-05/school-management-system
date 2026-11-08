import { ClientSession, FilterQuery, Model, Types } from 'mongoose';
import { AcademicYear } from '../../models/AcademicYear.js';
import { Class } from '../../models/Class.js';
import { ClassSubject } from '../../models/ClassSubject.js';
import { Enrollment } from '../../models/Enrollment.js';
import { FeeHead } from '../../models/FeeHead.js';
import { GradingScheme } from '../../models/GradingScheme.js';
import { Guardian } from '../../models/Guardian.js';
import { Section } from '../../models/Section.js';
import { Student } from '../../models/Student.js';
import { Subject } from '../../models/Subject.js';
import { Teacher } from '../../models/Teacher.js';
import { TeacherAssignment } from '../../models/TeacherAssignment.js';
import { StudentGuardian } from '../../models/StudentGuardian.js';

export type LooseDocument = Record<string, unknown> & { _id: Types.ObjectId };
type LooseModel = Model<LooseDocument>;
const asModel = (model: unknown) => model as LooseModel;

export const masterModels: Record<string, LooseModel> = {
  students: asModel(Student), guardians: asModel(Guardian), teachers: asModel(Teacher),
  classes: asModel(Class), sections: asModel(Section), subjects: asModel(Subject),
  'academic-years': asModel(AcademicYear), enrollments: asModel(Enrollment),
  'teacher-assignments': asModel(TeacherAssignment), 'class-subjects': asModel(ClassSubject),
  'fee-heads': asModel(FeeHead), 'grading-schemes': asModel(GradingScheme),
};

const searchFields: Record<string, string[]> = {
  students: ['full_name', 'admission_no'], guardians: ['full_name', 'phone'],
  teachers: ['full_name', 'employee_no'], classes: ['name'], sections: ['name'],
  subjects: ['name', 'code'], 'academic-years': ['name'], 'fee-heads': ['name'],
  'grading-schemes': ['name'],
};

export class MasterDataRepository {
  model(resource: string): LooseModel {
    const model = masterModels[resource];
    if (!model) throw new Error(`Unknown master resource: ${resource}`);
    return model;
  }

  async list(resource: string, options: { page: number; pageSize: number; q?: string; sort?: string }) {
    const model = this.model(resource);
    const query: FilterQuery<LooseDocument> = {};
    if (options.q && searchFields[resource]) {
      const escaped = options.q.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      query.$or = searchFields[resource].map((field) => ({ [field]: new RegExp(escaped, 'i') }));
    }
    const sortField = options.sort?.replace(/^-/, '') || '_id';
    const direction = options.sort?.startsWith('-') ? -1 : 1;
    const [data, total] = await Promise.all([
      model.find(query).sort({ [sortField]: direction }).skip((options.page - 1) * options.pageSize).limit(options.pageSize).lean(),
      model.countDocuments(query),
    ]);
    return { data, total };
  }

  async findById(resource: string, id: string, session?: ClientSession) {
    if (!Types.ObjectId.isValid(id)) return null;
    return this.model(resource).findById(id).session(session || null).lean();
  }

  async create(resource: string, data: Record<string, unknown>, session: ClientSession) {
    const docs = await this.model(resource).create([data], { session });
    return docs[0].toObject() as LooseDocument;
  }

  async update(resource: string, id: string, data: Record<string, unknown>, session: ClientSession) {
    return this.model(resource).findByIdAndUpdate(id, { $set: data }, { new: true, session, runValidators: true }).lean();
  }

  async deactivate(resource: string, id: string, session: ClientSession) {
    const model = this.model(resource);
    await model.collection.updateOne({ _id: new Types.ObjectId(id) }, { $set: { is_active: false, status: 'INACTIVE', updatedAt: new Date() } }, { session });
    return model.findById(id).session(session).lean();
  }

  async count(resource: string, filter: Record<string, unknown>, session: ClientSession) {
    return this.model(resource).countDocuments(filter).session(session);
  }

  async linkStudentGuardian(data: Record<string, unknown>, session: ClientSession) {
    const docs = await StudentGuardian.create([data], { session });
    return docs[0].toObject() as unknown as LooseDocument;
  }

  async unlinkStudentGuardian(studentId: string, guardianId: string, session: ClientSession) {
    return StudentGuardian.findOneAndDelete({ student_id: studentId, guardian_id: guardianId }, { session }).lean();
  }
}

export const masterDataRepository = new MasterDataRepository();

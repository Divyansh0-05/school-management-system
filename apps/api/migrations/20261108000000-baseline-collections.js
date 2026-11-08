export const up = async (db) => {
  // Helper to safely create collection with validator
  const ensureCollection = async (name, validator) => {
    const list = await db.listCollections({ name }).toArray();
    if (list.length === 0) {
      await db.createCollection(name, validator ? { validator } : {});
    } else if (validator) {
      try {
        await db.command({ collMod: name, validator });
      } catch (err) {
        console.warn(`Could not set validator on ${name}:`, err.message);
      }
    }
  };

  // 1. Identity
  await ensureCollection('users', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'password_hash', 'role'],
      properties: {
        email: { bsonType: 'string', pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' },
        password_hash: { bsonType: 'string' },
        role: { enum: ['ADMIN', 'TEACHER', 'GUARDIAN'] },
        is_active: { bsonType: 'bool' },
        failed_logins: { bsonType: 'int', minimum: 0 },
        locked_until: { bsonType: ['date', 'null'] },
      },
    },
  });
  await db.collection('users').createIndex({ email: 1 }, { unique: true });

  await ensureCollection('teachers', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['user_id', 'employee_no', 'full_name', 'phone'],
      properties: {
        user_id: { bsonType: 'objectId' },
        employee_no: { bsonType: 'string' },
        full_name: { bsonType: 'string' },
        phone: { bsonType: 'string' },
      },
    },
  });
  await db.collection('teachers').createIndex({ user_id: 1 }, { unique: true });
  await db.collection('teachers').createIndex({ employee_no: 1 }, { unique: true });

  await ensureCollection('guardians', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['user_id', 'full_name', 'phone'],
      properties: {
        user_id: { bsonType: 'objectId' },
        full_name: { bsonType: 'string' },
        phone: { bsonType: 'string' },
      },
    },
  });
  await db.collection('guardians').createIndex({ user_id: 1 }, { unique: true });

  // 2. Academics
  await ensureCollection('students', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['admission_no', 'full_name', 'dob', 'gender', 'status'],
      properties: {
        admission_no: { bsonType: 'string' },
        full_name: { bsonType: 'string' },
        dob: { bsonType: 'date' },
        gender: { enum: ['MALE', 'FEMALE', 'OTHER'] },
        status: { enum: ['ACTIVE', 'INACTIVE', 'GRADUATED'] },
      },
    },
  });
  await db.collection('students').createIndex({ admission_no: 1 }, { unique: true });
  await db.collection('students').createIndex({ full_name: 1 });
  await db.collection('students').createIndex({ status: 1 });

  await ensureCollection('student_guardians', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['student_id', 'guardian_id', 'relationship', 'is_primary'],
      properties: {
        student_id: { bsonType: 'objectId' },
        guardian_id: { bsonType: 'objectId' },
        relationship: { bsonType: 'string' },
        is_primary: { bsonType: 'bool' },
      },
    },
  });
  await db.collection('student_guardians').createIndex({ student_id: 1, guardian_id: 1 }, { unique: true });
  await db.collection('student_guardians').createIndex(
    { student_id: 1 },
    { unique: true, partialFilterExpression: { is_primary: true } }
  );

  await ensureCollection('academic_years', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'start_date', 'end_date', 'is_current'],
      properties: {
        name: { bsonType: 'string' },
        start_date: { bsonType: 'date' },
        end_date: { bsonType: 'date' },
        is_current: { bsonType: 'bool' },
      },
    },
  });
  await db.collection('academic_years').createIndex(
    { is_current: 1 },
    { unique: true, partialFilterExpression: { is_current: true } }
  );

  await ensureCollection('classes', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'level'],
      properties: {
        name: { bsonType: 'string' },
        level: { bsonType: 'int' },
      },
    },
  });
  await db.collection('classes').createIndex({ name: 1 }, { unique: true });
  await db.collection('classes').createIndex({ level: 1 });

  await ensureCollection('sections', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['class_id', 'academic_year_id', 'name'],
      properties: {
        class_id: { bsonType: 'objectId' },
        academic_year_id: { bsonType: 'objectId' },
        name: { bsonType: 'string' },
      },
    },
  });
  await db.collection('sections').createIndex({ class_id: 1, academic_year_id: 1, name: 1 }, { unique: true });

  await ensureCollection('subjects', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['code', 'name'],
      properties: {
        code: { bsonType: 'string' },
        name: { bsonType: 'string' },
      },
    },
  });
  await db.collection('subjects').createIndex({ code: 1 }, { unique: true });

  await ensureCollection('class_subjects', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['class_id', 'subject_id'],
      properties: {
        class_id: { bsonType: 'objectId' },
        subject_id: { bsonType: 'objectId' },
      },
    },
  });
  await db.collection('class_subjects').createIndex({ class_id: 1, subject_id: 1 }, { unique: true });

  await ensureCollection('enrollments', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['student_id', 'section_id', 'academic_year_id', 'roll_no'],
      properties: {
        student_id: { bsonType: 'objectId' },
        section_id: { bsonType: 'objectId' },
        academic_year_id: { bsonType: 'objectId' },
        roll_no: { bsonType: 'int', minimum: 1 },
      },
    },
  });
  await db.collection('enrollments').createIndex({ student_id: 1, academic_year_id: 1 }, { unique: true });
  await db.collection('enrollments').createIndex({ section_id: 1, roll_no: 1 }, { unique: true });

  await ensureCollection('teacher_assignments', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['teacher_id', 'section_id', 'subject_id', 'is_class_teacher'],
      properties: {
        teacher_id: { bsonType: 'objectId' },
        section_id: { bsonType: 'objectId' },
        subject_id: { bsonType: 'objectId' },
        is_class_teacher: { bsonType: 'bool' },
      },
    },
  });
  await db.collection('teacher_assignments').createIndex(
    { teacher_id: 1, section_id: 1, subject_id: 1 },
    { unique: true }
  );
  await db.collection('teacher_assignments').createIndex(
    { section_id: 1 },
    { unique: true, partialFilterExpression: { is_class_teacher: true } }
  );

  // 3. Attendance
  await ensureCollection('attendance_records', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['student_id', 'section_id', 'date', 'session', 'status', 'marked_by_user_id'],
      properties: {
        student_id: { bsonType: 'objectId' },
        section_id: { bsonType: 'objectId' },
        date: { bsonType: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        session: { enum: ['MORNING', 'AFTERNOON'] },
        status: { enum: ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] },
        marked_by_user_id: { bsonType: 'objectId' },
      },
    },
  });
  await db.collection('attendance_records').createIndex({ student_id: 1, date: 1, session: 1 }, { unique: true });
  await db.collection('attendance_records').createIndex({ section_id: 1, date: 1, session: 1 });
  await db.collection('attendance_records').createIndex({ student_id: 1, date: 1 });

  // 4. Exams
  await ensureCollection('grading_schemes', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'is_default', 'grading_bands'],
      properties: {
        name: { bsonType: 'string' },
        is_default: { bsonType: 'bool' },
        grading_bands: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            required: ['min_percent', 'grade', 'grade_point', 'remark'],
            properties: {
              min_percent: { bsonType: 'int', minimum: 0, maximum: 10000 },
              grade: { bsonType: 'string' },
              grade_point: { bsonType: 'int', minimum: 0 },
              remark: { bsonType: 'string' },
            },
          },
        },
      },
    },
  });
  await db.collection('grading_schemes').createIndex({ name: 1 }, { unique: true });

  await ensureCollection('exams', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'term', 'academic_year_id', 'class_id', 'grading_scheme_id', 'status', 'starts_on', 'exam_subjects'],
      properties: {
        name: { bsonType: 'string' },
        term: { bsonType: 'string' },
        academic_year_id: { bsonType: 'objectId' },
        class_id: { bsonType: 'objectId' },
        grading_scheme_id: { bsonType: 'objectId' },
        grading_snapshot: { bsonType: ['object', 'null'] },
        status: { enum: ['DRAFT', 'MARKS_OPEN', 'LOCKED', 'PUBLISHED'] },
        starts_on: { bsonType: 'date' },
        published_at: { bsonType: ['date', 'null'] },
        exam_subjects: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            required: ['subject_id', 'max_marks', 'pass_marks'],
            properties: {
              subject_id: { bsonType: 'objectId' },
              max_marks: { bsonType: 'int', minimum: 1 },
              pass_marks: { bsonType: 'int', minimum: 1 },
            },
          },
        },
      },
    },
  });
  await db.collection('exams').createIndex({ academic_year_id: 1, class_id: 1, status: 1 });

  await ensureCollection('marks', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['exam_id', 'subject_id', 'student_id', 'is_absent', 'entered_by_user_id'],
      properties: {
        exam_id: { bsonType: 'objectId' },
        subject_id: { bsonType: 'objectId' },
        student_id: { bsonType: 'objectId' },
        marks_obtained: { bsonType: ['int', 'null'], minimum: 0 },
        is_absent: { bsonType: 'bool' },
        entered_by_user_id: { bsonType: 'objectId' },
      },
    },
  });
  await db.collection('marks').createIndex({ exam_id: 1, subject_id: 1, student_id: 1 }, { unique: true });

  // 5. Fees
  await ensureCollection('fee_heads', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name'],
      properties: {
        name: { bsonType: 'string' },
      },
    },
  });
  await db.collection('fee_heads').createIndex({ name: 1 }, { unique: true });

  await ensureCollection('invoices', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['invoice_no', 'student_id', 'academic_year_id', 'period_label', 'due_date', 'status', 'total_paise', 'version', 'invoice_items'],
      properties: {
        invoice_no: { bsonType: 'string' },
        student_id: { bsonType: 'objectId' },
        academic_year_id: { bsonType: 'objectId' },
        period_label: { bsonType: 'string' },
        due_date: { bsonType: 'date' },
        status: { enum: ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'VOID'] },
        total_paise: { bsonType: 'int', minimum: 0 },
        issued_at: { bsonType: ['date', 'null'] },
        voided_at: { bsonType: ['date', 'null'] },
        void_reason: { bsonType: ['string', 'null'] },
        version: { bsonType: 'int', minimum: 0 },
        invoice_items: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            required: ['fee_head_id', 'description', 'amount_paise'],
            properties: {
              fee_head_id: { bsonType: 'objectId' },
              description: { bsonType: 'string' },
              amount_paise: { bsonType: 'int', minimum: 1 },
            },
          },
        },
      },
    },
  });
  await db.collection('invoices').createIndex({ invoice_no: 1 }, { unique: true });
  await db.collection('invoices').createIndex({ student_id: 1, period_label: 1 }, { unique: true });
  await db.collection('invoices').createIndex({ student_id: 1, status: 1 });

  await ensureCollection('payments', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['invoice_id', 'amount_paise', 'method', 'status', 'idempotency_key', 'request_hash', 'receipt_no', 'paid_by_user_id'],
      properties: {
        invoice_id: { bsonType: 'objectId' },
        amount_paise: { bsonType: 'int', minimum: 1 },
        method: { enum: ['SIMULATED_CARD', 'SIMULATED_UPI', 'CASH'] },
        status: { enum: ['SUCCEEDED', 'FAILED'] },
        idempotency_key: { bsonType: 'string' },
        request_hash: { bsonType: 'string' },
        receipt_no: { bsonType: 'string' },
        paid_by_user_id: { bsonType: 'objectId' },
      },
    },
  });
  await db.collection('payments').createIndex({ receipt_no: 1 }, { unique: true });
  await db.collection('payments').createIndex({ paid_by_user_id: 1, idempotency_key: 1 }, { unique: true });
  await db.collection('payments').createIndex({ invoice_id: 1, status: 1 });

  await ensureCollection('ledger_entries', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['student_id', 'invoice_id', 'type', 'amount_paise', 'created_by'],
      properties: {
        student_id: { bsonType: 'objectId' },
        invoice_id: { bsonType: 'objectId' },
        payment_id: { bsonType: ['objectId', 'null'] },
        type: { enum: ['INVOICE_ISSUED', 'PAYMENT', 'REVERSAL', 'INVOICE_VOID'] },
        amount_paise: { bsonType: 'int' },
        created_by: { bsonType: 'objectId' },
      },
    },
  });
  await db.collection('ledger_entries').createIndex({ student_id: 1 });
  await db.collection('ledger_entries').createIndex({ invoice_id: 1 });

  // 6. Audit
  await ensureCollection('audit_logs', {
    $jsonSchema: {
      bsonType: 'object',
      required: ['at', 'actor_user_id', 'actor_role', 'action', 'entity_type', 'entity_id', 'request_id', 'ip'],
      properties: {
        at: { bsonType: 'date' },
        actor_user_id: { bsonType: 'objectId' },
        actor_role: { enum: ['ADMIN', 'TEACHER', 'GUARDIAN'] },
        action: { bsonType: 'string' },
        entity_type: { bsonType: 'string' },
        entity_id: { bsonType: 'string' },
        before: { bsonType: ['object', 'null'] },
        after: { bsonType: ['object', 'null'] },
        request_id: { bsonType: 'string' },
        ip: { bsonType: 'string' },
      },
    },
  });
  await db.collection('audit_logs').createIndex({ entity_type: 1, entity_id: 1, at: -1 });
  await db.collection('audit_logs').createIndex({ actor_user_id: 1, at: -1 });
};

export const down = async (db) => {
  const collections = [
    'users',
    'teachers',
    'guardians',
    'students',
    'student_guardians',
    'academic_years',
    'classes',
    'sections',
    'subjects',
    'class_subjects',
    'enrollments',
    'teacher_assignments',
    'attendance_records',
    'grading_schemes',
    'exams',
    'marks',
    'fee_heads',
    'invoices',
    'payments',
    'ledger_entries',
    'audit_logs',
  ];
  for (const c of collections) {
    try {
      await db.collection(c).drop();
    } catch {
      // ignore
    }
  }
};


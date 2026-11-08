# Entity-Relationship (ER) Diagram

This document illustrates the data architecture and schema design for the School Management System, verified against the Mongoose models in `apps/api/src/models/` and MongoDB `$jsonSchema` collection validators.

---

## Architecture Conventions

- **Referenced Entities:** Stored in independent MongoDB collections and related via standard MongoDB `ObjectId` references.
- **Embedded Documents:** Denormalized structures (e.g. Addresses, Grading Bands, Invoice Line Items, Grading Snapshots) stored inline within parent documents for atomic reads and updates.
- **Strict Monetary Representation:** All financial quantities are stored strictly as integer **paise** (1 INR = 100 paise).
- **Strict Percentage & Marks Representation:** All exam marks and grading-band boundary percentages are stored as integer **hundredths** (e.g., 85.50% = 8550).
- **Append-Only Immutability:** Financial ledgers (`ledger_entries`) and audit logs (`audit_logs`) are append-only. Mongoose schema hooks and repository contracts reject `update` and `delete` operations.

---

## Mermaid ER Diagram

```mermaid
erDiagram
    %% Identity & Profiles
    User ||--o| Teacher : "profile for"
    User ||--o| Guardian : "profile for"
    User ||--o{ AuditLog : "acts in"
    User ||--o{ AttendanceRecord : "marks"
    User ||--o{ Mark : "enters"
    User ||--o{ Payment : "records"
    User ||--o{ LedgerEntry : "records"

    Teacher ||--o{ TeacherAssignment : "assigned to"
    Guardian ||--o{ StudentGuardian : "linked via"
    Student ||--o{ StudentGuardian : "cared for by"

    %% Academics & Enrollment
    AcademicYear ||--o{ Enrollment : "spans"
    AcademicYear ||--o{ TeacherAssignment : "schedules"
    AcademicYear ||--o{ AttendanceRecord : "tracks"
    AcademicYear ||--o{ Exam : "holds"
    AcademicYear ||--o{ Invoice : "bills for"

    Class ||--o{ Section : "contains"
    Class ||--o{ ClassSubject : "teaches"
    Class ||--o{ Enrollment : "enrolls in"
    Class ||--o{ Exam : "tested in"

    Subject ||--o{ ClassSubject : "mapped to"
    Subject ||--o{ TeacherAssignment : "instructed by"
    Subject ||--o{ Mark : "evaluated on"

    Section ||--o{ Enrollment : "groups"
    Section ||--o{ TeacherAssignment : "assigned"
    Section ||--o{ AttendanceRecord : "records daily"

    Student ||--o{ Enrollment : "enrolled as"
    Student ||--o{ AttendanceRecord : "attends"
    Student ||--o{ Mark : "scored in"
    Student ||--o{ Invoice : "billed"
    Student ||--o{ Payment : "pays"
    Student ||--o{ LedgerEntry : "accounted in"

    %% Examinations & Grading
    GradingScheme ||--o{ Exam : "configures"
    Exam ||--o{ Mark : "records marks for"

    %% Fees & Ledger
    FeeHead ||--o{ InvoiceItem : "categorizes"
    Invoice ||--|{ InvoiceItem : "embeds line items"
    Invoice ||--o{ Payment : "settled by"
    Invoice ||--o{ LedgerEntry : "recorded in"
    Payment ||--o{ LedgerEntry : "generates credit"

    %% ==========================================
    %% Entity Definitions
    %% ==========================================

    User {
        ObjectId _id PK
        string email UK "Unique lowercase"
        string password_hash "Bcrypt cost >= 12"
        string role "ADMIN | TEACHER | GUARDIAN"
        boolean is_active
        int failed_login_attempts
        date locked_until "Null if active"
        date created_at
        date updated_at
    }

    Teacher {
        ObjectId _id PK
        ObjectId user_id FK,UK "Ref User"
        string employee_id UK "Unique employee code"
        string full_name
        string phone
        string specialization
        date joining_date
        boolean is_active
    }

    Guardian {
        ObjectId _id PK
        ObjectId user_id FK,UK "Ref User"
        string full_name
        string phone
        string relationship "FATHER | MOTHER | OTHER"
        string occupation
        Address address "Embedded Subdocument"
        boolean is_active
    }

    Student {
        ObjectId _id PK
        string admission_number UK "Unique admission code"
        int roll_number "Index(roll_number, status)"
        string first_name
        string last_name
        date date_of_birth
        string gender "MALE | FEMALE | OTHER"
        string status "ACTIVE | INACTIVE | SUSPENDED | ALUMNI"
        Address address "Embedded Subdocument"
        boolean is_active
    }

    StudentGuardian {
        ObjectId _id PK
        ObjectId student_id FK "Ref Student, UK(student_id, guardian_id)"
        ObjectId guardian_id FK "Ref Guardian, UK(student_id, guardian_id)"
        string relationship "FATHER | MOTHER | OTHER"
        boolean is_primary
        boolean can_pickup
    }

    AcademicYear {
        ObjectId _id PK
        string name UK "e.g. 2026-2027"
        date start_date
        date end_date
        boolean is_current "Partial UK(is_current=true)"
    }

    Class {
        ObjectId _id PK
        string name UK "e.g. Grade 6"
        int grade_level UK "e.g. 6"
        string description
    }

    Section {
        ObjectId _id PK
        ObjectId class_id FK "Ref Class, UK(class_id, name)"
        string name "e.g. A, UK(class_id, name)"
        string room_number
        int capacity
    }

    Subject {
        ObjectId _id PK
        string name
        string code UK "e.g. MATH-6"
        string type "THEORY | PRACTICAL | COMBINED"
    }

    ClassSubject {
        ObjectId _id PK
        ObjectId class_id FK "Ref Class, UK(class_id, subject_id)"
        ObjectId subject_id FK "Ref Subject, UK(class_id, subject_id)"
        boolean is_elective
    }

    Enrollment {
        ObjectId _id PK
        ObjectId student_id FK "Ref Student, UK(student_id, academic_year_id)"
        ObjectId academic_year_id FK "Ref AcademicYear"
        ObjectId class_id FK "Ref Class"
        ObjectId section_id FK "Ref Section, UK(section_id, academic_year_id, roll_number)"
        int roll_number
        date enrollment_date
        string status "ACTIVE | PROMOTED | TRANSFERRED | DROPPED"
    }

    TeacherAssignment {
        ObjectId _id PK
        ObjectId teacher_id FK "Ref Teacher, UK(teacher_id, section_id, subject_id, academic_year_id)"
        ObjectId section_id FK "Ref Section"
        ObjectId subject_id FK "Ref Subject"
        ObjectId academic_year_id FK "Ref AcademicYear"
        boolean is_primary_class_teacher "Partial UK(section_id, academic_year_id where true)"
    }

    AttendanceRecord {
        ObjectId _id PK
        ObjectId student_id FK "Ref Student, UK(student_id, date, session)"
        ObjectId section_id FK "Ref Section"
        ObjectId academic_year_id FK "Ref AcademicYear"
        date date
        string session "MORNING | AFTERNOON"
        string status "PRESENT | ABSENT | LATE | EXCUSED"
        ObjectId marked_by FK "Ref User"
        string remarks
    }

    GradingScheme {
        ObjectId _id PK
        string name UK "e.g. Standard 10-Point CBSE"
        string description
        boolean is_default
        GradingBand bands "Embedded Subdocument Array"
    }

    Exam {
        ObjectId _id PK
        string name "UK(academic_year_id, class_id, term, name)"
        ObjectId academic_year_id FK "Ref AcademicYear"
        ObjectId class_id FK "Ref Class"
        string term "TERM_1 | TERM_2 | FINAL"
        date start_date
        date end_date
        string status "DRAFT | MARKS_OPEN | LOCKED | PUBLISHED"
        ObjectId grading_scheme_id FK "Ref GradingScheme"
        GradingSnapshot grading_snapshot "Embedded Immutable Snapshot on LOCKED"
    }

    Mark {
        ObjectId _id PK
        ObjectId exam_id FK "Ref Exam, UK(exam_id, subject_id, student_id)"
        ObjectId subject_id FK "Ref Subject"
        ObjectId student_id FK "Ref Student"
        int marks_obtained "Integer hundredths (85.50 = 8550)"
        int max_marks "Integer hundredths (100.00 = 10000)"
        string grade
        int grade_point "Integer hundredths (9.0 = 900)"
        boolean is_absent
        string remarks
        ObjectId entered_by FK "Ref User"
    }

    FeeHead {
        ObjectId _id PK
        string name UK "e.g. Tuition Fee"
        string code UK "e.g. TUITION"
        string description
        string type "TUITION | TRANSPORT | EXAM | LAB | LIBRARY | MISC"
        boolean is_recurring
    }

    Invoice {
        ObjectId _id PK
        string invoice_number UK "Unique e.g. INV-2026-0001"
        ObjectId student_id FK "Ref Student"
        ObjectId academic_year_id FK "Ref AcademicYear"
        date due_date
        string status "PENDING | PARTIALLY_PAID | PAID | OVERDUE | VOID"
        InvoiceItem items "Embedded Subdocument Array"
        int total_amount_paise "Integer paise"
        int paid_amount_paise "Integer paise"
    }

    Payment {
        ObjectId _id PK
        string payment_number UK "Unique e.g. PAY-2026-0001"
        ObjectId invoice_id FK "Ref Invoice"
        ObjectId student_id FK "Ref Student"
        int amount_paise "Integer paise"
        date payment_date
        string payment_method "CASH | SIMULATED_CARD | SIMULATED_UPI"
        string status "SUCCEEDED | FAILED"
        string idempotency_key UK "Unique client UUID"
        string transaction_reference
        string gateway_response
        ObjectId recorded_by FK "Ref User"
    }

    LedgerEntry {
        ObjectId _id PK
        string entry_number UK "Unique append-only e.g. LED-0001"
        ObjectId student_id FK "Ref Student"
        ObjectId invoice_id FK "Ref Invoice"
        ObjectId payment_id FK "Ref Payment (optional)"
        string entry_type "INVOICE_ISSUED | PAYMENT_RECEIVED | DISCOUNT_APPLIED | REFUND_ISSUED | REVERSAL"
        int amount_paise "Signed integer paise"
        int balance_after_paise "Running balance in paise"
        string description
        ObjectId recorded_by FK "Ref User"
        date timestamp "Index(student_id, timestamp)"
    }

    AuditLog {
        ObjectId _id PK
        ObjectId actor_id FK "Ref User, Index(actor_id, timestamp)"
        string actor_role
        string action "e.g. STUDENT_CREATE"
        string entity_type "Index(entity_type, entity_id)"
        string entity_id
        object before_state "Embedded JSON state"
        object after_state "Embedded JSON state"
        string request_id
        string ip_address
        date timestamp
    }
```

---

## Embedded Subdocuments Specification

### 1. `Address`
Embedded directly in `Student` and `Guardian` collections:
```typescript
{
  street: string;
  city: string;
  state: string;
  postal_code: string;
  country: string; // default "India"
}
```

### 2. `GradingBand`
Embedded array inside `GradingScheme`:
```typescript
{
  grade: string;              // e.g. "A1"
  min_percentage: number;     // Integer hundredths (e.g. 9100 for 91.00%)
  max_percentage: number;     // Integer hundredths (e.g. 10000 for 100.00%)
  grade_point: number;        // Integer hundredths (e.g. 1000 for 10.00)
  description?: string;
}
```

### 3. `GradingSnapshot`
Embedded snapshot inside `Exam`, populated atomically when the exam status transitions to `LOCKED`:
```typescript
{
  grading_scheme_id: ObjectId;
  name: string;
  bands: GradingBand[];
  locked_at: Date;
}
```

### 4. `InvoiceItem`
Embedded array inside `Invoice`:
```typescript
{
  fee_head_id: ObjectId;      // Ref FeeHead
  amount_paise: number;       // Integer paise (e.g. 500000 for ₹5,000.00)
  description?: string;
}
```

---

## Key Indexes and Invariants

| Collection | Index / Invariant | Type | Purpose |
|---|---|---|---|
| `users` | `email` | Unique | Enforces 1 user account per email address |
| `teachers` | `user_id` | Unique | 1:1 relationship with `User` |
| `teachers` | `employee_id` | Unique | Business identifier |
| `guardians` | `user_id` | Unique | 1:1 relationship with `User` |
| `students` | `admission_number` | Unique | Immutable student identifier |
| `students` | `roll_number, status` | Compound | Student directory filtering |
| `student_guardians` | `student_id, guardian_id` | Compound Unique | Prevents duplicate guardian pairings |
| `academic_years` | `name` | Unique | Unique academic session naming |
| `academic_years` | `is_current` (partial `true`) | Partial Unique | Guarantees exactly one active academic year |
| `classes` | `name` & `grade_level` | Unique | Distinct academic grade levels |
| `sections` | `class_id, name` | Compound Unique | No duplicate section names within a grade |
| `subjects` | `code` | Unique | Standard subject code index |
| `class_subjects` | `class_id, subject_id` | Compound Unique | Prevents duplicate curriculum subject mappings |
| `enrollments` | `student_id, academic_year_id` | Compound Unique | Single enrollment per student per academic year |
| `enrollments` | `section_id, academic_year_id, roll_number` | Compound Unique | Unique roll number within a section |
| `teacher_assignments` | `teacher_id, section_id, subject_id, academic_year_id` | Compound Unique | Invariant: no duplicate teacher-section-subject assignments |
| `teacher_assignments` | `section_id, academic_year_id` (partial `is_primary_class_teacher: true`) | Partial Unique | Invariant: at most one primary class teacher per section per academic year |
| `attendance_records` | `student_id, date, session` | Compound Unique | Prevents duplicate session attendance for a student |
| `grading_schemes` | `name` | Unique | Disallows duplicate scheme names |
| `exams` | `academic_year_id, class_id, term, name` | Compound Unique | Disallows duplicate exams for same class and term |
| `marks` | `exam_id, subject_id, student_id` | Compound Unique | Invariant: exactly one mark record per student-exam-subject |
| `fee_heads` | `name` & `code` | Unique | Distinguishes fee head definitions |
| `invoices` | `invoice_number` | Unique | Legal invoicing sequence identifier |
| `payments` | `payment_number` | Unique | Payment transaction identifier |
| `payments` | `idempotency_key` | Unique | Deduplicates client payment submissions |
| `ledger_entries` | `entry_number` | Unique | Immutable append-only audit sequence |
| `ledger_entries` | `student_id, timestamp` | Compound | Fast student ledger balance and statement generation |
| `audit_logs` | `entity_type, entity_id` | Compound | Entity audit history queries |
| `audit_logs` | `actor_id, timestamp` | Compound | User activity audit trails |


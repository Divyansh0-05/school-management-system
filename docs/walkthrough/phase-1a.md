# Phase 1A Walkthrough: Data Model, Authentication, Scoped RBAC & Audit

## 1. Plain-Language Explanation of What Was Built and Why

Phase 1A establishes the core persistence, identity, security, and auditing backbone for the School Management System. It deliberately stops short of master-data CRUD endpoints and UI (reserved for Phase 1B), focusing strictly on building rock-solid, production-grade foundations:

1. **Complete Database Schema & Invariants (`apps/api/src/models/`):**
   - Implemented all 21 Mongoose models matching Section 5 of the build brief: `User`, `Teacher`, `Guardian`, `Student`, `StudentGuardian`, `AcademicYear`, `Class`, `Section`, `Subject`, `ClassSubject`, `Enrollment`, `TeacherAssignment`, `AttendanceRecord`, `GradingScheme`, `Exam`, `Mark`, `FeeHead`, `Invoice`, `Payment`, `LedgerEntry`, and `AuditLog`.
   - Built with strict schema types, enums, compound unique indexes, and partial-unique indexes (e.g., exactly one active academic year via `{ is_current: true }`, at most one primary class teacher per section via `{ is_primary_class_teacher: true }`).
   - Zero floating-point math: all monetary amounts are stored strictly as integer **paise** (1 INR = 100 paise), and all marks and grading band percentages are stored strictly as integer **hundredths** (85.50% = 8550).
   - Append-only immutability: Mongoose pre-hooks on `AuditLog` and `LedgerEntry` block `update` and `delete` operations at the driver level.

2. **Automated Migrations (`apps/api/migrations/`):**
   - Configured `migrate-mongo` with cross-platform compatibility (`npm run db:migrate`, `db:seed`, `db:reset`).
   - Created baseline migration `20261108000000-baseline-collections.js` creating all 21 collections with MongoDB `$jsonSchema` validators and all indexes directly in the database engine.

3. **Deterministic Modular Seed Scripts (`apps/api/src/seed/`):**
   - Seeded identity and academics with deterministic faker seeds (`seed(12345)`):
     - Demo accounts: `admin@school.demo`, `teacher1@school.demo` (multi-section), `teacher2@school.demo` (single-section), `guardian1@school.demo` (2 children), and `guardian2@school.demo` (1 child).
     - Academic structures: 1 current academic year (2026-2027), 3 classes (Grade 6-8), 6 sections (A & B for each class), 8 subjects, curriculum mappings (`ClassSubject`), 60 students (10 per section), 45 guardians with sibling cases, 60 active enrollments, and teacher assignments.
   - Built modularly so upcoming phases (Phase 2 attendance, Phase 3 exams, Phase 4 fees) can seamlessly attach domain seeds.
   - Guarded against accidental production execution (refuses to run unless `ALLOW_DEMO_SEED=true`).

4. **Production Authentication Service (`apps/api/src/modules/auth/`):**
   - `POST /api/v1/auth/login`: Timing-attack-resistant authentication using `bcryptjs` (cost factor 12) with dummy hash comparison for non-existent users. Generic error messages prevent email enumeration.
   - Account lockout: Automatically locks accounts for 15 minutes after 5 consecutive failed attempts. Deactivated accounts are rejected.
   - Session management: Stores JWT (15-minute lifespan) inside an `httpOnly`, `SameSite=Lax` cookie (marked `Secure` in production). Sliding refresh silently extends the cookie lifetime on active requests when within 5 minutes of expiration.
   - `POST /api/v1/auth/logout`: Clears the session cookie.
   - `GET /api/v1/auth/me`: Returns the authenticated user's profile and role.
   - `POST /api/v1/auth/change-password`: Verifies current password before updating.

5. **Central Authorization & Scoped Tenancy Pattern (`apps/api/src/authz/`, `apps/api/src/modules/students/`):**
   - Central policy engine `can(user, action, resource, context)` defining explicit permissions.
   - Route-level middleware (`requireAuth`, `requireRole`) returns `401 Unauthorized` for missing/invalid credentials and `403 Forbidden` for role violations.
   - Scoped repository pattern: Repository queries for teachers and guardians are scoped to their permitted entity IDs (`StudentRepository.findAll(actor, query)` and `findById(actor, id)`):
     - `admin` sees all 60 students.
     - `teacher1` sees 20 students in sections 6A and 7A.
     - `teacher2` sees 10 students in section 6A.
     - `guardian1` sees their 2 linked children.
     - `guardian2` sees their 1 linked child.
     - If a user queries a student outside their assigned/linked scope, the repository returns `null`, and the service triggers a standard `404 Not Found` (eliminating data existence leakage).

6. **Append-Only Audit Service (`apps/api/src/audit/`):**
   - `AuditLogRepository` exposes only `create` and `find`.
   - `recordAuditLog` helper records actor, role, action, entity type, entity ID, before/after states, request ID, and IP address within the same MongoDB transaction session as the business mutation.

7. **Contract-First OpenAPI Documentation (`apps/api/src/docs/`):**
   - Leverages `@asteasolutions/zod-to-openapi` extending Zod schemas from `packages/shared`.
   - Generates OpenAPI 3.1 specification at `docs/openapi.json` and serves interactive Swagger UI at `/api/docs`.

---

## 2. Request Flow for Main Feature (Scoped Student Query & Authorization)

The following sequence illustrates how a scoped query is processed with zero information leakage:

```
1. Client (Browser / Supertest)
   ↓ GET /api/v1/students/:id (with auth_token cookie or Bearer token)
2. Express Middleware Pipeline
   ↓ requestIdMiddleware: Assigns or forwards X-Request-ID
   ↓ cookieParser: Parses httpOnly cookie 'auth_token'
   ↓ authenticate:
     - Verifies JWT against JWT_SECRET
     - Looks up User in MongoDB (ensures is_active=true, not locked)
     - Evaluates sliding token expiration (issues refreshed cookie if < 5m remaining)
     - Attaches req.user
   ↓ requireAuth: Rejects unauthenticated requests with 401 Unauthorized
3. Student Controller (StudentController.getById)
   ↓ Extracts :id parameter and passes (req.user, id) to StudentService
4. Student Service (StudentService.getStudentById)
   ↓ Authorization Check: can(actor, 'STUDENT_READ', 'Student', { targetStudentId: id })
     - If actor.role === 'ADMIN': permitted
     - If actor.role === 'TEACHER': calls StudentRepository.getAssignedStudentIds(teacher.id)
     - If actor.role === 'GUARDIAN': calls StudentRepository.getLinkedStudentIds(guardian.id)
     - If target ID is not in permitted set: returns false
   ↓ If can() returns false:
     - Throws NotFoundError('Student not found') -> Returns 404 Not Found (NO 403 LEAK)
   ↓ If can() returns true:
     - Calls StudentRepository.findById(actor, id)
     - Maps to StudentDetailResponse DTO
5. Express Response
   ↓ 200 OK + Student JSON payload (or 404 Problem Details RFC 7807)
```

---

## 3. Likely "Live Change" Tasks & Files to Touch

1. **Task: Add a new permission rule for a new action (e.g. `STUDENT_ARCHIVE`)**
   - Touch `apps/api/src/authz/policy.ts`: Define action constant and add rule logic in `can()` function.
   - Touch `apps/api/tests/unit/policy.test.ts`: Add unit test assertions for each role.
2. **Task: Adjust account lockout thresholds or lockout duration**
   - Touch `.env.example` and `apps/api/src/config/env.ts`: Modify `MAX_FAILED_LOGIN_ATTEMPTS` or `LOCKOUT_DURATION_MINUTES`.
   - Touch `apps/api/src/modules/auth/auth.service.ts`: Update lockout evaluation logic if needed.
   - Touch `apps/api/tests/integration/auth.test.ts`: Update test assertions verifying lockout timing.
3. **Task: Add a new domain model or collection (e.g. for Phase 2 attendance)**
   - Touch `apps/api/src/models/`: Verify model schema, indexes, and pre-hooks.
   - Touch `apps/api/migrations/`: Create a new numbered migration file for any schema updates.
   - Touch `packages/shared/src/schemas/`: Add Zod schema contracts and export them.
   - Touch `apps/api/src/docs/openapi.ts`: Register endpoint paths and parameters with Swagger docs.

---

## 4. Five Questions a Reviewer Might Ask (With Answers)

1. **Q: Why return `404 Not Found` instead of `403 Forbidden` when a guardian requests another student's ID?**  
   *A:* Returning `403 Forbidden` informs an attacker or curious user that the requested student ID actually exists in the school database (a data existence leak). Returning `404 Not Found` treats unauthorized resource access identically to a non-existent ID, preventing enumeration of student records.

2. **Q: How does the system defend against timing attacks during login?**  
   *A:* In `auth.service.ts`, if a requested email is not found in the database, the code still executes `bcrypt.compare` against a pre-computed dummy hash. This ensures that the response time for invalid emails matches the response time for valid emails with incorrect passwords, eliminating user enumeration via timing analysis.

3. **Q: Why are `AuditLog` and `LedgerEntry` updates and deletions blocked at both the repository and Mongoose schema levels?**  
   *A:* A repository can be bypassed if an engineer imports the raw model directly. By registering Mongoose pre-hooks (`pre('updateOne')`, `pre('deleteOne')`, etc.) that throw errors on any mutating operation, we provide defense-in-depth: neither accidental service logic nor direct model calls can ever alter historical audit or ledger records.

4. **Q: How is the database migration system tested during continuous integration?**  
   *A:* The integration test `tests/integration/migration-seed.test.ts` connects to an isolated temporary database, executes `migrate-mongo up` from scratch to verify all collection creation and `$jsonSchema` validators, and then runs the seed script to verify complete data population without throwing validation or indexing errors.

5. **Q: Why are marks and percentages stored as integer hundredths instead of floating-point numbers?**  
   *A:* JavaScript floating-point arithmetic introduces IEEE-754 rounding inaccuracies (e.g., `0.1 + 0.2 !== 0.3`). In academic grade cutoffs (e.g. 89.99% vs 90.00%) and financial ledger reconciliation, even 0.001 of a discrepancy causes incorrect grade assignment or audit failure. Storing `85.50%` as integer `8550` guarantees 100% exact math.


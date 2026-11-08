# Phase 1B Walkthrough: Master-Data APIs

## What was built

Phase 1B adds admin-only, paginated APIs under `/api/v1` for students, guardians, teachers, classes, sections, subjects, academic years, enrollments, teacher assignments, class-subject mappings, fee heads, and grading schemes. Student GET routes retain the Phase 1A teacher/guardian scope behavior. Guardian links support create/delete, and unique indexes enforce one primary guardian per student, one current academic year, and one class teacher per section.

All mutation paths use the existing `withTransaction` and `recordAuditLog` helpers. Teacher and guardian creation creates a bcrypt cost-12 user and profile atomically. Zod schemas produce 422 responses; duplicate/index and domain invariant failures produce coded 409 responses; role middleware produces 401/403. Next.js already reads `API_URL` for rewrites, and the root `.env.example` documents it.

## Request flow: create a teacher

1. `POST /api/v1/teachers` passes `requireAuth`, `requireRole(ADMIN)`, and the shared Zod body schema.
2. The controller passes the validated body and request metadata to `MasterDataService`.
3. The service opens a Mongo transaction, hashes the temporary password, creates `User` and `Teacher`, then writes the audit row with the same session.
4. The repository owns Mongoose `create`; the transaction commits both records or neither.
5. The controller returns `201 { data }`; errors are converted by the central RFC 7807 handler.

## Three likely live changes

1. Add a new master resource: update `packages/shared/src/schemas/master-data.ts`, `master-data.repository.ts`, and `master-data.routes.ts`, then add its reference rules in `master-data.service.ts`.
2. Add a searchable indexed field: add the model index and the field to `searchFields` in `master-data.repository.ts`, plus a query integration test.
3. Add a relationship invariant: implement the check in `master-data.service.ts` using a session, add a coded `ConflictError`, and cover it in `master-data.test.ts`.

## Reviewer Q&A

1. **Why is the service shared?** The resources share pagination, transactions, audit, and error mapping; relationship checks remain explicit branches.
2. **Why are deletes deactivations?** Referenced records cannot be physically removed; the repository writes inactive state and the service rejects references.
3. **How is audit atomic?** `recordAuditLog` receives the same `ClientSession` before the transaction callback completes.
4. **How are grading bands safe?** Bands must be ascending, unique, non-overlapping, and include minimum 0; referenced non-DRAFT schemes cannot be edited.
5. **How do scoped student reads remain safe?** The existing student router remains mounted first and still uses `StudentRepository` scope resolution for teacher and guardian GETs.

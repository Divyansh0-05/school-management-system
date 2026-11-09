# Phase 2A Walkthrough: Attendance API

## What was built

Attendance now has timezone-safe calendar dates, scoped section/student reads, teacher edit-window enforcement, guardian read-only access, admin access, idempotent transactional bulk writes, duplicate-safe single writes, reports, summaries, audit entries, and deterministic idempotent seed history.

## PUT request flow

1. The route authenticates the cookie and rejects guardian writes before body processing.
2. Shared Zod validation checks the date, session, statuses, ObjectIds, and duplicate student IDs.
3. The service normalizes/validates the school-local date, checks the teacher window, and asks the scoped repository for the section and current-year enrollments.
4. One Mongo transaction upserts every `(student_id, date, session)` row. Existing status changes and new rows call the audit helper with the same session; unchanged rows do not.
5. The unique compound index protects races; duplicate-key attempts retry the transaction. Any audit failure aborts the transaction and rolls back all rows.

## Likely live changes

1. Make `LATE` count as half-present: update `apps/api/src/modules/attendance/attendance.summary.ts` and its unit tests.
2. Change the teacher edit window: update `ATTENDANCE_EDIT_WINDOW_DAYS` in `.env.example`/deployment configuration and verify the service tests.
3. Add `SICK`: update `packages/shared/src/schemas/attendance.ts`, `apps/api/src/models/AttendanceRecord.ts`, migration validators, and summary tests.

## Reviewer Q&A

1. **Why store a string date?** It is the school-local calendar date, so UTC conversion cannot split one school day into two records.
2. **Why does PUT not create duplicates?** It upserts on the unique student/date/session key inside a transaction.
3. **Why do teachers get 404 for other sections?** Repository scope intentionally hides whether an unassigned section exists.
4. **Why are unchanged retries not audited?** Audit records represent creates and actual status transitions, not transport retries.
5. **What does a guardian see?** Only linked students and their attendance; write routes return 403.

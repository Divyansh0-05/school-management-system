# Acceptance Criteria Traceability Matrix

This document tracks the five primary demonstrable acceptance criteria required by the project specification, mapping each requirement to automated tests and manual demo verification steps.

| ID | Description | Primary Phase | Automated Tests | Demo Verification Flow | Status |
|---|---|---|---|---|---|
| **A1** | A teacher can access only assigned classes and record attendance. | Phase 2 *(Foundation in 1A)* | `apps/api/tests/integration/students-scoping.test.ts` (Phase 1A foundation)<br>`apps/api/tests/integration/attendance-access.test.ts` (Phase 2) | Log in as `teacher2@school.demo` (single-section). Verify inability to view or mark attendance for unassigned sections (404/403). Log in as `teacher1@school.demo` and successfully mark attendance. | In Progress (Scoped queries verified in 1A) |
| **A2** | Duplicate attendance for the same student/session is rejected or safely updated. | Phase 2 *(Foundation in 1A)* | `apps/api/tests/integration/schema-validators.test.ts` (Phase 1A unique index & schema validation)<br>`apps/api/tests/integration/attendance-duplicate.test.ts` (Phase 2) | Submit single attendance via `POST /api/v1/attendance` twice to verify `409 ATTENDANCE_ALREADY_RECORDED`. Submit idempotent bulk `PUT /api/v1/sections/:id/attendance` concurrently with 50 parallel requests and verify exactly one record per student. | In Progress (Compound index verified in 1A) |
| **A3** | An exam result is calculated correctly from configured marks and grading rules. | Phase 3 *(Foundation in 1A)* | `apps/api/tests/integration/exam-results.test.ts` (coming in Phase 3) | View exam in MARKS_OPEN, enter marks (including absent and boundary percentages), transition to LOCKED (snapshotting grading scheme), then PUBLISHED. Verify grade calculation against hand-verified rubric and verify report card. | Pending |
| **A4** | A guardian sees only the linked student's allowed information. | Phase 5 *(Foundation in 1A)* | `apps/api/tests/integration/students-scoping.test.ts` (Phase 1A scoped query & 404 test)<br>`apps/api/tests/integration/guardian-scoping.test.ts` (Phase 5) | Log in as `guardian1@school.demo` (2 children). Switch between linked children. Attempt direct URL/API access to `guardian2@school.demo`'s student profile, attendance, report card, and invoices; verify `404 Not Found`. | In Progress (Data scoping verified in 1A) |
| **A5** | Fee due and paid totals reconcile with the fee ledger. | Phase 4 *(Foundation in 1A)* | `apps/api/tests/integration/audit.test.ts` (Phase 1A append-only ledger immutability)<br>`apps/api/tests/integration/fee-reconciliation.test.ts` (Phase 4) | Generate invoices for section. Make partial and full simulated payments with idempotency keys. Verify double-payment rejection and run reconciliation report showing `invoiced - paid = outstanding = sum(ledger)` with 0 discrepancies. | In Progress (Append-only immutability verified in 1A) |

---

## Traceability Notes

- **Phase 1A Verification:**
  - Automated integration tests in `apps/api/tests/integration/students-scoping.test.ts` verified that `admin` sees all 60 students, `teacher1` sees exactly 20 students across assigned sections 6A and 7A, `teacher2` sees exactly 10 students in assigned section 6A, `guardian1` sees exactly 2 linked children, and `guardian2` sees exactly 1 linked child.
  - Cross-family access (e.g. `guardian1` attempting `GET /api/v1/students/:child3Id`) returns `404 Not Found` with zero existence leakage.
  - Immutability of append-only records (`AuditLog` and `LedgerEntry`) is enforced by Mongoose pre-hooks and tested in `apps/api/tests/integration/audit.test.ts`.
  - Database-level integrity and invariants (uniqueness, foreign keys, compound keys) are verified via `migrate-mongo` and `apps/api/tests/integration/schema-validators.test.ts`.
- **A1 & A2 (Attendance):** Attendance workflows and teacher entry window will be completed in Phase 2.
- **A3 (Exams & Grading):** Pure-function grade calculation, ranking, and report card generation will be delivered in Phase 3.
- **A4 (Guardian Scoping):** Guardian portal UI and consolidated guardian-scoped queries will be finalized in Phase 5.
- **A5 (Fees & Ledger Reconciliation):** Invoicing, payment idempotency, and automated ledger reconciliation will be delivered in Phase 4.

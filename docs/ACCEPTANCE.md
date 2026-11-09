# Acceptance Criteria Traceability Matrix

This document tracks the five primary demonstrable acceptance criteria required by the project specification, mapping each requirement to automated tests and manual demo verification steps.

| ID | Description | Primary Phase | Automated Tests | Demo Verification Flow | Status |
|---|---|---|---|---|---|
| **A1** | A teacher can access only assigned classes and record attendance. | Phase 2 | `apps/api/tests/integration/attendance.test.ts` — `enforces assigned-section, guardian-write, and anonymous rules` | Log in as `teacher2@school.demo` (single-section). Verify inability to view or mark attendance for unassigned sections (404). Log in as `teacher1@school.demo` and successfully mark attendance. | Implemented |
| **A2** | Duplicate attendance for the same student/session is rejected or safely updated. | Phase 2 | `apps/api/tests/integration/attendance.test.ts` — `bulk PUT is idempotent and only audits status changes`; `rejects duplicate single attendance and validates all records atomically`; `rejects future, cross-section, and invalid enum records, and handles 50 idempotent requests` | Submit single attendance twice for `409 ATTENDANCE_ALREADY_RECORDED`; submit 50 identical bulk requests and verify exactly one record per student. | Implemented |
| **A3** | An exam result is calculated correctly from configured marks and grading rules. | Phase 3 | `apps/api/tests/unit/grading.test.ts` — `uses inclusive boundaries and half-up integer rounding`, `handles absent, all-fail, mixed pass/fail, custom bands, and missing marks`, `assigns dense ranks with ties`; `apps/api/tests/integration/exams.test.ts` — `returns hand-calculated seeded boundary, absent, failing, and tied results`, `keeps the grading snapshot stable and blocks referenced scheme edits` | View the seeded published exam, verify 90.00% vs 89.99%, absent/failing/tied results, and change the referenced scheme to confirm the snapshot remains stable. | Implemented |
| **A4** | A guardian sees only the linked student's allowed information. | Phase 5 *(Foundation in 1A)* | `apps/api/tests/integration/students-scoping.test.ts` (Phase 1A scoped query & 404 test)<br>`apps/api/tests/integration/guardian-scoping.test.ts` (Phase 5) | Log in as `guardian1@school.demo` (2 children). Switch between linked children. Attempt direct URL/API access to `guardian2@school.demo`'s student profile, attendance, report card, and invoices; verify `404 Not Found`. | In Progress (Data scoping verified in 1A) |
| **A5** | Fee due and paid totals reconcile with the fee ledger. | Phase 4 *(Foundation in 1A)* | `apps/api/tests/integration/audit.test.ts` (Phase 1A append-only ledger immutability)<br>`apps/api/tests/integration/fee-reconciliation.test.ts` (Phase 4) | Generate invoices for section. Make partial and full simulated payments with idempotency keys. Verify double-payment rejection and run reconciliation report showing `invoiced - paid = outstanding = sum(ledger)` with 0 discrepancies. | In Progress (Append-only immutability verified in 1A) |
| **A6** | Admin master-data CRUD is paginated, validated, audited, and role protected. | Phase 1B | `apps/api/tests/integration/master-data.test.ts` | Log in as admin and create/update/deactivate master data; verify 401 anonymous, 403 non-admin, 409 duplicate/reference conflicts, and audit rows. | Implemented |
| **A7** | Academic relationships preserve primary guardian, curriculum, class-teacher, current-year, and grading-band invariants. | Phase 1B | `apps/api/tests/integration/master-data.test.ts` | Attempt invalid assignment, duplicate class teacher, second current year, or invalid grading bands and verify domain conflicts. | Implemented |

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

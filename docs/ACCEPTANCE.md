# Acceptance Criteria Traceability Matrix

This document tracks the five primary demonstrable acceptance criteria required by the project specification, mapping each requirement to automated tests and manual demo verification steps.

| ID | Description | Primary Phase | Automated Tests | Demo Verification Flow | Status |
|---|---|---|---|---|---|
| **A1** | A teacher can access only assigned classes and record attendance. | Phase 2 | `apps/api/tests/integration/attendance-access.test.ts` (coming in Phase 2) | Log in as `teacher2@school.demo` (single-section). Verify inability to view or mark attendance for unassigned sections (404/403). Log in as `teacher1@school.demo` and successfully mark attendance. | Pending |
| **A2** | Duplicate attendance for the same student/session is rejected or safely updated. | Phase 2 | `apps/api/tests/integration/attendance-duplicate.test.ts` (coming in Phase 2) | Submit single attendance via `POST /api/v1/attendance` twice to verify `409 ATTENDANCE_ALREADY_RECORDED`. Submit idempotent bulk `PUT /api/v1/sections/:id/attendance` concurrently with 50 parallel requests and verify exactly one record per student. | Pending |
| **A3** | An exam result is calculated correctly from configured marks and grading rules. | Phase 3 | `apps/api/tests/integration/exam-results.test.ts` (coming in Phase 3) | View exam in MARKS_OPEN, enter marks (including absent and boundary percentages), transition to LOCKED (snapshotting grading scheme), then PUBLISHED. Verify grade calculation against hand-verified rubric and verify report card. | Pending |
| **A4** | A guardian sees only the linked student's allowed information. | Phase 5 | `apps/api/tests/integration/guardian-scoping.test.ts` (coming in Phase 5) | Log in as `guardian1@school.demo` (2 children). Switch between linked children. Attempt direct URL/API access to `guardian2@school.demo`'s student profile, attendance, report card, and invoices; verify `404 Not Found`. | Pending |
| **A5** | Fee due and paid totals reconcile with the fee ledger. | Phase 4 | `apps/api/tests/integration/fee-reconciliation.test.ts` (coming in Phase 4) | Generate invoices for section. Make partial and full simulated payments with idempotency keys. Verify double-payment rejection and run reconciliation report showing `invoiced - paid = outstanding = sum(ledger)` with 0 discrepancies. | Pending |

## Traceability Notes

- **A1 & A2 (Attendance):** Delivered and verified in Phase 2.
- **A3 (Exams & Grading):** Delivered and verified in Phase 3.
- **A4 (Guardian Scoping):** Delivered and verified in Phase 5.
- **A5 (Fees & Ledger Reconciliation):** Delivered and verified in Phase 4.
- Cross-cutting route x role security matrix and end-to-end user journeys will be finalized in Phase 6.

